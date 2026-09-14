// Render the vector master at each installable-app size.
const sharp=require('sharp');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
(async()=>{
  for(const size of [180,192,512]) await sharp(path.join(root,'logo.svg')).resize(size,size).flatten({background:'#0c1118'}).png().toFile(path.join(root,`icon-${size}.png`));
  await sharp(path.join(root,'logo.svg')).resize(410,410).extend({top:51,bottom:51,left:51,right:51,background:'#0c1118'}).flatten({background:'#0c1118'}).png().toFile(path.join(root,'icon-maskable.png'));
  for(const file of ['ic-upper-a-192.png','ic-upper-b-192.png','ic-pierna-192.png','ic-crossfit-192.png']){
    const target=path.join(root,file);
    const png=await sharp(target).flatten({background:'#0c1118'}).png().toBuffer();
    await fs.promises.writeFile(target,png);
  }
})().catch(e=>{console.error(e);process.exitCode=1});
