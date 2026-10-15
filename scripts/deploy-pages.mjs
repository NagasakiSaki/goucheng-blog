import {execFileSync} from 'node:child_process';
import {mkdirSync,cpSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';

const root=process.cwd(),stage=path.join(root,'.artifacts','pages-deploy');
const remote='https://github.com/NagasakiSaki/goucheng-blog.git';
const run=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
if(!existsSync(path.join(root,'dist','index.html')))throw new Error('Run npm run build before deployment.');
mkdirSync(stage,{recursive:true});
if(!existsSync(path.join(stage,'.git'))){run(['init','-b','gh-pages'],stage);run(['remote','add','origin',remote],stage);}
if(run(['remote','get-url','origin'],stage)!==remote)throw new Error('Unexpected deployment remote; no files pushed.');
cpSync(path.join(root,'dist'),stage,{recursive:true});
writeFileSync(path.join(stage,'.nojekyll'),'');
run(['add','.'],stage);
const changed=run(['status','--porcelain'],stage);
if(changed)run(['-c','user.name=NagasakiSaki','-c','user.email=196273039+NagasakiSaki@users.noreply.github.com','commit','-m','Publish GOUCHENG blog'],stage);
console.log(run(['push','origin','HEAD:gh-pages'],stage));
console.log('Public build pushed. GitHub Pages will deploy the gh-pages branch.');
