const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const input=process.argv[2];
const files={mail:'exec-2c6e1052-c478-45a5-b0e9-37013d596c76.png',soda:'exec-f92de89d-b9fd-47b7-853c-0712bad4b98c.png',moon:'exec-00abbae5-cf23-4701-bd20-fa50e77f7346.png'};
Object.assign(files,{fireworks:'exec-83c26cc9-5ade-44b2-94e4-67bf4f6ce53f.png',ghost:'exec-6375fe8b-3373-4d0b-a8f6-82240ef2b5ef.png',bakery:'exec-e1fae2b0-cdfe-4e67-97bf-3c3f550fae84.png'});
(async()=>{fs.mkdirSync(path.join(__dirname,'assets'),{recursive:true});fs.mkdirSync(path.join(__dirname,'source/art'),{recursive:true});for(const [key,file]of Object.entries(files)){
const src=input?path.join(input,file):path.join(__dirname,'source/art',key+'.png');if(input)fs.copyFileSync(src,path.join(__dirname,'source/art',key+'.png'));
await sharp(src).webp({quality:87}).toFile(path.join(__dirname,'assets',key+'.webp'));console.log(key+' ready');
}})().catch(e=>{console.error(e);process.exitCode=1});
