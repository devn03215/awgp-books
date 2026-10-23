import assert from 'node:assert/strict';
for (const origin of ['https://awgp.link','https://awgp.app']) {
 for(let attempt=0;;attempt++) {
  try {
   const response=await fetch(`${origin}/__deployment/repos?check=${process.env.GITHUB_SHA}`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
   assert.equal(response.status,200);
   const deployment=await response.json();
   assert.equal(deployment.repositories[process.env.GITHUB_REPOSITORY],process.env.GITHUB_SHA);
   break;
  } catch(error) {
   if(attempt>=119)throw error;
   await new Promise(resolve=>setTimeout(resolve,5000));
  }
 }
 const response=await fetch(`${origin}/books/`,{signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);
 assert.equal(response.headers.get('X-AWGP-Host'),'railway');
 console.log(`${origin}: ${process.env.GITHUB_REPOSITORY}@${process.env.GITHUB_SHA} is live on Railway.`);
}
