// Контуры и разрезы общей медиатекстуры; у соседних пластин непрерывные UV.
export const MEDIA_OUTLINES=[
  [[-2.9,-2.3],[-2.45,2.3],[1.95,2.3],[2.9,-1.75],[2.55,-2.3]],
  [[-2.9,-2.0],[-2.35,2.3],[1.65,2.3],[2.9,-2.3]],
  [[-2.9,-2.3],[-2.5,1.8],[-1.95,2.3],[2.2,2.3],[2.9,-2.3]],
];
export function mediaOutline(index) { return MEDIA_OUTLINES[index%MEDIA_OUTLINES.length]; }
export function mediaCuts(index) { return {slope:[-.17,.12,-.1][index%3],levels:[-1.05,1.05],gap:.055}; }
// Sutherland–Hodgman: вырезаем полосы относительно y - slope*x = level.
function clip(points,slope,level,above){
  const output=[];
  const value=p=>(p[1]-slope*p[0]-level)*(above?1:-1);
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],va=value(a),vb=value(b);
    if(va>=0)output.push(a);
    if((va>=0)!==(vb>=0)){const u=va/(va-vb);output.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]);}
  }
  return output;
}
export function mediaSegments(index){
  const outline=mediaOutline(index),{slope,levels,gap}=mediaCuts(index);
  return [clip(outline,slope,levels[0]-gap/2,false),
    clip(clip(outline,slope,levels[0]+gap/2,true),slope,levels[1]-gap/2,false),
    clip(outline,slope,levels[1]+gap/2,true)];
}
export function mediaSeams(index){
  const outline=mediaOutline(index),{slope,levels}=mediaCuts(index);
  return levels.map(level=>{
    const intersections=[];
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length],va=a[1]-slope*a[0]-level,vb=b[1]-slope*b[0]-level;
      if((va<0&&vb>=0)||(va>=0&&vb<0)){const u=va/(va-vb);intersections.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]);}
    }
    return intersections;
  });
}

// Плоскости снаружи изображения оставляют центральный путь камеры свободным.
export function mediaSupports(side){
  const outer=side,edge=outer*2.7;
  return [
    [[edge,-2.3],[edge,2.3],[outer*4.15,3.35],[outer*4.35,-3.0]],
    [[outer*4.15,3.35],[outer*5.25,4.05],[outer*5.35,.35],[outer*4.35,-3.0]],
    [[edge,2.3],[outer*1.95,2.3],[outer*2.4,3.15],[outer*4.15,3.35]],
  ];
}
