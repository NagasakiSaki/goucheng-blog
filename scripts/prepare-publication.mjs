import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {buildPublication,PUBLICATION} from '../src/publication.js';

// Authentication stays in GitHub CLI's credential manager. It is never placed in the site.
const issues=[];
for(let page=1;page<=5;page++){
  const endpoint=`repos/${PUBLICATION.owner}/${PUBLICATION.repo}/issues?state=open&labels=article&creator=${PUBLICATION.owner}&per_page=100&page=${page}`;
  const batch=JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8'}));
  issues.push(...batch);if(batch.length<100)break;
}
const config=JSON.parse(readFileSync(new URL('../public/site.json',import.meta.url),'utf8'));
const published=buildPublication(issues,config);
published.revision=published.posts.map(p=>`${p.id}:${p.updatedAt}`).join('|');
writeFileSync(new URL('../src/published-snapshot.json',import.meta.url),JSON.stringify(published,null,2)+'\n');
console.log(`Prepared ${published.posts.length} public articles. Drafts, reader history and local comments excluded.`);
