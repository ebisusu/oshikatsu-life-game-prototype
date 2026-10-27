// All random choices are explicit state transitions. Never uses Math.random.
export function random(seed:number):[number,number] {
  const next = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, next];
}
export function shuffle<T>(values:T[], seed:number):[T[],number] {
  const out = [...values];
  for(let i=out.length-1;i>0;i--){const [r,s]=random(seed);seed=s;const j=Math.floor(r*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return [out,seed];
}
