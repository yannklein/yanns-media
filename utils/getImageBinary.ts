const getImageBinary = async (mediaPath: string) => {
  try {
    const url = 'https://content.dropboxapi.com/2/files/get_thumbnail_v2';
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          size: 'w640h480',
          resource: {
            '.tag': 'path',
            path: mediaPath,
          },
          format: { '.tag': 'png' },
        }),
      },
      redirect: 'follow',
    };
    const response = await fetch(url, requestOptions);
    const arrayBuffer = await response.arrayBuffer(); // Convert the response to a Blob
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, endpoint: ${url}`);
    }
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(error);
    return null;
  }
};

export { getImageBinary };
