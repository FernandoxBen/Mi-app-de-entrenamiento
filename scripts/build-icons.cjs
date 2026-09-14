// Render the vector master at each installable-app size.
const sharp=require('sharp');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
  for(const size of [180,192,512]) await sharp(path.join(root,'logo.svg')).resize(size,size).png().toFile(path.join(root,`icon-${size}.png`));
  await sharp(path.join(root,'logo.svg')).resize(410,410).extend({top:51,bottom:51,left:51,right:51,background:'#0c1118'}).png().toFile(path.join(root,'icon-maskable.png'));
})().catch(e=>{console.error(e);process.exitCode=1});
