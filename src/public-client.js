import {buildPublication,PUBLICATION,applyPublication} from './publication.js';
import {freshState,validateBackup} from './model.js';
import snapshot from './published-snapshot.json';

export const PUBLIC_MODE=import.meta.env.PROD;
const CACHE_KEY=`goucheng-public:${PUBLICATION.owner}/${PUBLICATION.repo}`;
let pending=null;
let lastCheck=0;
const clean = publication => {
  const valid=validateBackup({...freshState(),...publication});
  return {version:2,site:valid.site,author:valid.author,posts:valid.posts};
};
export function publicInitialState(personal) {
  let published=snapshot;
  try{const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(cached?.publication&&Date.now()-cached.at<7*86400000)published=clean(cached.publication);}catch{/* use the bundled last-known publication */}
  return applyPublication(personal,published);
}
export function fetchPublication({force=false}={}){
  if(pending)return pending;
  if(!force&&Date.now()-lastCheck<90000)return Promise.resolve(null);
  lastCheck=Date.now();
  pending=(async()=>{
    const issues=[];
    for(let page=1;page<=5;page++){
      const endpoint=`https://api.github.com/repos/${PUBLICATION.owner}/${PUBLICATION.repo}/issues?state=open&labels=article&per_page=100&page=${page}`;
      const response=await fetch(endpoint,{cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(response.status===403||response.status===429?'更新请求暂时受限，稍后重试即可。':'暂时无法连接文章源，请稍后重试。');
      const batch=await response.json();if(!Array.isArray(batch))throw new Error('文章源格式异常');
      issues.push(...batch);if(batch.length<100)break;
    }
    let config={site:snapshot.site,author:snapshot.author};
    try{const response=await fetch(`https://raw.githubusercontent.com/${PUBLICATION.owner}/${PUBLICATION.repo}/main/public/site.json`,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});if(response.ok)config=await response.json();}catch{/* site profile can use the deployed fallback */}
    const publication=clean(buildPublication(issues,config));
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),publication}));}catch{/* fresh public data remains readable when browser storage is full */}
    return publication;
  })().finally(()=>{pending=null;});
  return pending;
}
