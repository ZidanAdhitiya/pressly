import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const jobsDir = path.join(root, 'storage', 'prepress', 'jobs');
const maxUploadBytes = 50 * 1024 * 1024;
const products = new Set([
  'Banner','X-Banner','Spanduk','Sticker','Poster','Kartu Nama','Cetak Sertifikat','Stiker Chromo A3+',
  'Cetak Flyer/Brosur','Canvas Custom','Spanduk Banner','Cetak Kertas Kado','Gantungan Kunci','ID Card',
  'Mini Banner','Mug Custom','Roll Up Banner','Stiker Meteran','Stiker One Way','Stiker Transparan A3',
  'Stiker Vinyl A3+','X/Y Banner','Art Paper 120gsm','Art Paper 210gsm','Art Paper 150gsm',
  'Art Paper 260gsm','Art Paper 310gsm','Tripod Banner',
]);
const bulkStickers = new Set(['Sticker','Stiker Chromo A3+','Stiker Meteran','Stiker Transparan A3','Stiker Vinyl A3+']);
const finishings = new Set(['Matik','Selongsong','Roll Banner']);
const jobs = new Map();

function numberPair(value) {
  const match = String(value).match(/^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*$/i);
  if (!match) return null;
  const factor = ({mm:0.1,cm:1,m:100}[String(match[3]||'cm').toLowerCase()] || 1);
  return [Number(match[1].replace(',','.'))*factor, Number(match[2].replace(',','.'))*factor];
}
function physicalSize(size, product) {
  const pair=numberPair(size); if(pair)return pair;
  const named={A4:[21,29.7],A3:[29.7,42],A2:[42,59.4]};
  if(named[size]) return product==='Cetak Sertifikat'?[...named[size]].reverse():named[size];
  const fallback={Banner:[300,100],'X-Banner':[60,160],Spanduk:[100,300],Sticker:[29.7,42],Poster:[21,29.7],'Kartu Nama':[9,5.5]};
  return fallback[product]||[100,100];
}
function parseFinishing(physical, product, width, height, finishing) {
  if (!finishing) return [0,0,0,0];
  if (!finishings.has(finishing) || !['Banner','X-Banner','Spanduk','Spanduk Banner','Mini Banner','Roll Up Banner','X/Y Banner','Tripod Banner'].includes(product)) throw new Error('Finishing hanya tersedia untuk produk banner.');
  const scale=Math.max(width/physical[0],height/physical[1]);
  const [left,right,top,bottom]=finishing==='Selongsong'?[2.5,2.5,8,8]:finishing==='Roll Banner'?[2.5,2.5,2.5,8]:[2.5,2.5,2.5,2.5];
  return [left,right,top,bottom].map(value=>Math.round(value*scale));
}
function fitCanvas(size, product, scaleUp, orientation) {
  const [wCm,hCm]=physicalSize(size,product);
  let w=wCm,h=hCm;
  if(numberPair(size)&&['horizontal','vertical'].includes(orientation)) {
    if(orientation==='horizontal'&&w<h)[w,h]=[h,w];
    if(orientation==='vertical'&&w>h)[w,h]=[h,w];
  }
  const factor=1800/Math.max(w,h)*(scaleUp?2:1);
  return {width:Math.max(1,Math.round(w*factor)),height:Math.max(1,Math.round(h*factor)),physical:[w,h]};
}
function safeText(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function pruneExpiredJobs() {
  try { for(const id of await fs.readdir(jobsDir)) { if(!/^[a-f0-9]{32}$/i.test(id))continue;try{const data=JSON.parse(await fs.readFile(path.join(jobsDir,id,'job.json'),'utf8'));if(Date.now()-Number(data.createdAt)>30*60*1000){jobs.delete(id);await fs.rm(path.join(jobsDir,id),{recursive:true,force:true});}}catch{await fs.rm(path.join(jobsDir,id),{recursive:true,force:true});}} } catch {}
}
async function rasterizePdf(buffer) {
  const doc=await getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true,cMapUrl:new URL('./node_modules/pdfjs-dist/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./node_modules/pdfjs-dist/standard_fonts/',import.meta.url).href}).promise;
  try {
    const page=await doc.getPage(1),base=page.getViewport({scale:1}),scale=1800/Math.max(base.width,base.height),viewport=page.getViewport({scale});
    const canvasFactory=doc.canvasFactory,canvasAndContext=canvasFactory.create(viewport.width,viewport.height);
    await page.render({canvasContext:canvasAndContext.context,viewport,background:'rgb(255,255,255)'}).promise;
    return canvasAndContext.canvas.toBuffer('image/png');
  } finally { await doc.destroy(); }
}
async function inputRaster(buffer,extension) {
  if(extension==='pdf')return rasterizePdf(buffer);
  return sharp(buffer,{limitInputPixels:100_000_000}).rotate().png().toBuffer();
}
async function drawLayout(designBuffer, fields, size, product, outputFormat) {
  const scaleUp=String(fields.scale_up||'true').toLowerCase()!=='false';
  const {width,height,physical}=fitCanvas(size,product,scaleUp,String(fields.preview_orientation||''));
  if(width*height>40_000_000)throw new Error('Ukuran layout terlalu besar. Kurangi dimensi atau nonaktifkan perbesaran kualitas.');
  const [left,right,top,bottom]=parseFinishing(physical,product,width,height,String(fields.finishing||''));
  const finalWidth=width+left+right, finalHeight=height+top+bottom;
  const content=await sharp(designBuffer,{limitInputPixels:100_000_000}).rotate().resize(width,height,{fit:'fill'}).flatten({background:'#ffffff'}).png().toBuffer();
  const name=String(fields.customer||'').trim().slice(0,50);
  const guide=`<svg xmlns="http://www.w3.org/2000/svg" width="${finalWidth}" height="${finalHeight}"><rect x="1" y="1" width="${finalWidth-2}" height="${finalHeight-2}" fill="none" stroke="#000" stroke-width="4"/>${left||right||top||bottom?`<rect x="${left+1}" y="${top+1}" width="${width-2}" height="${height-2}" fill="none" stroke="#000" stroke-width="4"/>`:''}${name&&top?`<text x="${left+12}" y="${Math.max(28,Math.round(top*.55))}" font-family="sans-serif" font-size="${Math.max(20,Math.min(52,Math.round(top*.3)))}" fill="#000">${safeText(name)}</text>`:''}</svg>`;
  const mode=String(fields.color_mode||'Original');
  let image=sharp({create:{width:finalWidth,height:finalHeight,channels:3,background:'#fff'}})
    .composite([{input:content,left,top},{input:Buffer.from(guide),left:0,top:0}]);
  if(mode==='Grayscale')image=image.greyscale();else if(mode==='CMYK'&&['JPG','PDF'].includes(outputFormat))image=image.toColourspace('cmyk');else image=image.toColourspace('srgb');
  let outputBuffer;
  if(outputFormat==='PDF') {
    const density=Math.round(1800/Math.max(...physical)*2.54);
    const cmyk=mode==='CMYK',raster=cmyk?await image.jpeg({quality:92,mozjpeg:true}).withMetadata({density}).toBuffer():await image.png().withMetadata({density}).toBuffer();
    const pdf=await PDFDocument.create(),embedded=cmyk?await pdf.embedJpg(raster):await pdf.embedPng(raster);
    const pageWidth=(finalWidth/(width/physical[0]))*72/2.54,pageHeight=(finalHeight/(height/physical[1]))*72/2.54;
    const page=pdf.addPage([pageWidth,pageHeight]);page.drawImage(embedded,{x:0,y:0,width:pageWidth,height:pageHeight});outputBuffer=Buffer.from(await pdf.save());
  } else if(outputFormat==='JPG') outputBuffer=await image.jpeg({quality:92,mozjpeg:true}).withMetadata({density:Math.round(1800/Math.max(...physical)*2.54)}).toBuffer();
  else outputBuffer=await image.png().withMetadata({density:Math.round(1800/Math.max(...physical)*2.54)}).toBuffer();
  const preview=await sharp(outputBuffer,{density:120}).resize(1200,1200,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
  return {outputBuffer,preview,width:finalWidth,height:finalHeight};
}
async function drawStickerSheet(designBuffer, size, stickerSize, shape) {
  const match=String(stickerSize||'').match(/^\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm\s*$/i);
  if(!match)throw new Error('Ukuran sticker tidak valid.');
  const sw=Number(match[1].replace(',','.')),sh=Number(match[2].replace(',','.')),sheetW=29.7,sheetH=42,gap=.3;
  const across=Math.floor((sheetW+gap)/(sw+gap)),down=Math.floor((sheetH+gap)/(sh+gap)),count=across*down;
  if(!count||count>300)throw new Error('Ukuran sticker tidak valid untuk satu lembar A3.');
  const width=1273,height=1800,tw=Math.max(1,Math.round(width*sw/sheetW)),th=Math.max(1,Math.round(height*sh/sheetH)),gx=Math.max(1,Math.round(width*gap/sheetW)),gy=Math.max(1,Math.round(height*gap/sheetH));
  const startX=Math.max(0,Math.floor((width-(across*tw+(across-1)*gx))/2)),startY=Math.max(0,Math.floor((height-(down*th+(down-1)*gy))/2));
  const tiles=[];
  for(let i=0;i<count;i++){
    let tile=await sharp(designBuffer).resize(tw,th,{fit:'fill'}).png().toBuffer();
    if(String(shape).toLowerCase()==='bulat'){
      const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}"><circle cx="${tw/2}" cy="${th/2}" r="${Math.min(tw,th)/2}" fill="white"/></svg>`);
      tile=await sharp(tile).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
    }
    tiles.push({input:tile,left:startX+(i%across)*(tw+gx),top:startY+Math.floor(i/across)*(th+gy)});
  }
  const output=await sharp({create:{width,height,channels:3,background:'#fff'}}).composite(tiles).jpeg({quality:92}).withMetadata({density:109}).toBuffer();
  return {output,count,width,height};
}

export async function createLayout(file, fields) {
  if(!file?.buffer?.length)throw new Error('File desain wajib diunggah.');
  if(file.buffer.length>maxUploadBytes)throw new Error('Ukuran file melebihi batas 50 MB.');
  const extension=path.extname(file.originalname||'').slice(1).toLowerCase();
  if(!['jpg','jpeg','png','pdf'].includes(extension))throw new Error('Format file harus JPG, PNG, atau PDF.');
  const product=String(fields.product||'').trim(),size=String(fields.size||'').trim();
  if(!products.has(product))throw new Error('Pilih tipe produk terlebih dahulu.');
  if(!size||(!['A2','A3','A4'].includes(size)&&!numberPair(size)))throw new Error('Ukuran harus dipilih atau diisi dengan format seperti 60x160 cm.');
  if(numberPair(size)){const [w,h]=physicalSize(size,product),area=w*h/10000,limits={Banner:[.25,1000],'X-Banner':[.3,100],Spanduk:[.25,1000],Sticker:[.0004,10],Poster:[.01,100],'Kartu Nama':[.0002,.1]},[minimum,maximum]=limits[product]||[.0001,1000];if(area<minimum||area>maximum)throw new Error('Ukuran produk terlalu kecil atau terlalu besar.');}
  if(bulkStickers.has(product)&&size!=='A3')throw new Error('Produk sticker ini hanya diproses pada kertas A3.');
  if(String(fields.finishing||'')&&!finishings.has(String(fields.finishing)))throw new Error('Finishing tidak valid.');
  if(!['Original','RGB','CMYK','Grayscale'].includes(String(fields.color_mode||'Original')))throw new Error('Setting warna tidak valid.');
  const outputFormat=String(fields.output_format||'PNG').toUpperCase();
  if(!['PNG','JPG','PDF'].includes(outputFormat))throw new Error('Format output tidak valid.');
  const orientation=String(fields.preview_orientation||'horizontal').toLowerCase();
  if(!['horizontal','vertical'].includes(orientation))throw new Error('Orientasi preview tidak valid.');
  await pruneExpiredJobs();
  const id=crypto.randomBytes(16).toString('hex'),folder=path.join(jobsDir,id);await fs.mkdir(folder,{recursive:true});
  try {
    let design=await inputRaster(file.buffer,extension),stickerCount=0;
    let {outputBuffer,preview}=await drawLayout(design,fields,size,product,outputFormat);
    if(bulkStickers.has(product)){
      const sheet=await drawStickerSheet(design,size,String(fields.sticker_size||''),String(fields.sticker_shape||'Kotak'));
      stickerCount=sheet.count;
      if(outputFormat==='PDF'){
        const png=await sharp(sheet.output).png().toBuffer(),pdf=await PDFDocument.create(),embedded=await pdf.embedPng(png),page=pdf.addPage([297*72/2.54,420*72/2.54]);page.drawImage(embedded,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});outputBuffer=Buffer.from(await pdf.save());
      } else if(outputFormat==='PNG')outputBuffer=await sharp(sheet.output).png().toBuffer();else outputBuffer=sheet.output;
      preview=await sharp(sheet.output).resize(1200,1200,{fit:'inside',withoutEnlargement:true}).png().toBuffer();
    }
    const ext=({PNG:'png',JPG:'jpg',PDF:'pdf'})[outputFormat],base=[String(fields.customer||'customer'),product,size,...(fields.finishing?[String(fields.finishing)]:[])].join('_').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,150)||'layout';
    const outputName=`${base}.${ext}`;
    await Promise.all([fs.writeFile(path.join(folder,'preview.png'),preview),fs.writeFile(path.join(folder,`output.${ext}`),outputBuffer),fs.writeFile(path.join(folder,'job.json'),JSON.stringify({id,outputName,ext,createdAt:Date.now(),orderId:String(fields.order_id||'')}))]);
    jobs.set(id,{folder,outputName,ext,createdAt:Date.now()});
    const colorspace=String(fields.color_mode||'Original')==='CMYK'&&['JPG','PDF'].includes(outputFormat)?'CMYK':String(fields.color_mode||'')==='Grayscale'?'Gray':'sRGB';
    return {id,output_name:outputName,preview_url:`/api/layouts/${id}/preview`,download_url:`/api/layouts/${id}/output`,colorspace,sticker_count:stickerCount,order_id:String(fields.order_id||'')||null,saved_layout:null,folder,outputPath:path.join(folder,`output.${ext}`)};
  } catch(error) { await fs.rm(folder,{recursive:true,force:true});throw error; }
}

export async function getLayoutFile(id,kind) {
  if(!/^[a-f0-9]{32}$/i.test(id)||!['preview','output'].includes(kind))return null;
  let job=jobs.get(id);
  if(!job){try{const data=JSON.parse(await fs.readFile(path.join(jobsDir,id,'job.json'),'utf8'));job={folder:path.join(jobsDir,id),outputName:data.outputName,ext:data.ext,createdAt:data.createdAt};jobs.set(id,job);}catch{return null;}}
  if(Date.now()-job.createdAt>30*60*1000){jobs.delete(id);await fs.rm(job.folder,{recursive:true,force:true});return null;}
  try{return {path:path.join(job.folder,kind==='preview'?'preview.png':`output.${job.ext}`),outputName:job.outputName};}catch{return null;}
}
