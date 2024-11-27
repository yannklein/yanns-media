import fs from 'fs';

const storeLocally = (imageUploaded: any): {public_id: string, version: number, format: string} | null => {
  try {    
    const name = `${new Date().toISOString()}-image.png`
    const path = `/mediasThumbnails/${name}`;
    fs.writeFileSync(`./public${path}`, imageUploaded, { flag: 'w' });
    if (!path) throw new Error('Could not save image');
    return {public_id: path, version: 1, format: 'png'}
  } catch (err) {
    console.error(err);
    return null;
  }
};

export { storeLocally };
