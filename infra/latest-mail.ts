import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';

if(process.env.NODE_ENV==='production')throw new Error('Local mail preview is disabled in production.');
const directory=resolve(process.env.EMAIL_OUTBOX_DIR??'.local/mail');
const files=(await readdir(directory)).filter(file=>file.endsWith('.json'));
const dated=await Promise.all(files.map(async file=>({file,time:(await stat(resolve(directory,file))).mtimeMs})));
const latest=dated.sort((a,b)=>b.time-a.time)[0];
if(!latest)throw new Error('No local email found. Request a sign-in link first.');
const message=JSON.parse(await readFile(resolve(directory,latest.file),'utf8')) as {url?:unknown};
if(typeof message.url!=='string')throw new Error('Latest local email has no sign-in URL.');
process.stdout.write(`${message.url}\n`);
