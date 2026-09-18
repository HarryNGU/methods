/* Shared helpers for the Methods 3 & 4 interactive diagrams: exact number formatting,
   KaTeX rendering with a plain text fallback, and a small SVG plotting class. */
(function(){
  var NS='http://www.w3.org/2000/svg';

  function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){var t=a%b;a=b;b=t}return a}

  // A number as an exact fraction when it has a small denominator, otherwise a tidy decimal.
  function frac(v,dp){
    if(dp===undefined) dp=3;
    if(Math.abs(v)<1e-12) return '0';
    var s=v<0?'-':'', x=Math.abs(v), dens=[1,2,3,4,5,6,8,10,12,16,20,24,32];
    for(var i=0;i<dens.length;i++){var d=dens[i],n=Math.round(x*d);
      if(Math.abs(x*d-n)<1e-9){var g=gcd(n,d);n/=g;d/=g;return d===1?s+n:s+'\\tfrac{'+n+'}{'+d+'}';}}
    return s+dec(x,dp);
  }
  // Radians as a multiple of pi, e.g. \tfrac{3\pi}{4}.
  function fracPi(v){
    var r=v/Math.PI; if(Math.abs(r)<1e-12) return '0';
    var s=r<0?'-':'', x=Math.abs(r), dens=[1,2,3,4,6,8,12,24,36];
    for(var i=0;i<dens.length;i++){var d=dens[i],n=Math.round(x*d);
      if(Math.abs(x*d-n)<1e-9){var g=gcd(n,d);n/=g;d/=g;var num=(n===1?'':n)+'\\pi';
        return d===1?s+num:s+'\\tfrac{'+num+'}{'+d+'}';}}
    return s+dec(Math.abs(v),3);
  }
  // Decimal with trailing zeros stripped.
  function dec(v,dp){if(dp===undefined)dp=3;var t=(+v).toFixed(dp);if(t.indexOf('.')>=0)t=t.replace(/0+$/,'').replace(/\.$/,'');return t==='-0'?'0':t}
  // Fixed decimals, as a calculator shows them.
  function fix(v,dp){var t=(+v).toFixed(dp);return t.replace(/^-0(\.0+)?$/,'0$1')}
  function signed(v,f){f=f||frac;return v>=0?'+'+f(v):'-'+f(-v)}

  function plain(t){return t.replace(/\\tfrac\{([^}]*)\}\{([^}]*)\}/g,'$1/$2').replace(/\\sqrt\{?(\d+)\}?/g,'√$1')
    .replace(/\^2/g,'²').replace(/\\pi/g,'π').replace(/\\theta/g,'θ').replace(/\\mu/g,'μ').replace(/\\sigma/g,'σ')
    .replace(/\\(left|right|,|;|!|quad|qquad)/g,' ').replace(/\\[a-zA-Z]+/g,'').replace(/[{}]/g,'').replace(/-/g,'−')}
  function tex(node,t,display){
    if(window.katex){try{katex.render(t,node,{throwOnError:false,displayMode:!!display});return}catch(e){}}
    node.textContent=plain(t);
  }
  // Render every <span class="m" data-tex="..."> on the page.
  function texAll(root){(root||document).querySelectorAll('[data-tex]').forEach(function(n){tex(n,n.getAttribute('data-tex'))})}

  function el(tag,attrs,parent){var e=document.createElementNS(NS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}

  // ---------- plotting ----------
  function Plot(svg,o){
    this.svg=svg; this.W=o.W||560; this.H=o.H||560;
    svg.setAttribute('viewBox','0 0 '+this.W+' '+this.H);
    this.id='p'+Math.random().toString(36).slice(2,8);
    this.defs=el('defs',{},svg);
    var cp=el('clipPath',{id:this.id+'c'},this.defs); el('rect',{x:0,y:0,width:this.W,height:this.H},cp);
    var mk=el('marker',{id:this.id+'a',viewBox:'0 0 10 10',refX:'8',refY:'5',markerWidth:'7',markerHeight:'7',orient:'auto-start-reverse'},this.defs);
    el('path',{d:'M0 0 L10 5 L0 10 z',fill:'#A6A6AD'},mk);
    this.bg=el('g',{},svg);
    this.layer=el('g',{'clip-path':'url(#'+this.id+'c)'},svg);
    this.top=el('g',{},svg);
    this.setWindow(o.xmin,o.xmax,o.ymin,o.ymax);
  }
  Plot.prototype.setWindow=function(xmin,xmax,ymin,ymax){this.xmin=xmin;this.xmax=xmax;this.ymin=ymin;this.ymax=ymax};
  Plot.prototype.sx=function(x){return (x-this.xmin)/(this.xmax-this.xmin)*this.W};
  Plot.prototype.sy=function(y){return (this.ymax-y)/(this.ymax-this.ymin)*this.H};
  Plot.prototype.el=function(tag,attrs,parent){return el(tag,attrs,parent||this.layer)};
  Plot.prototype.clear=function(g){while(g.firstChild)g.removeChild(g.firstChild)};
  // SVG path for y=f(x), broken where f is not finite. Values are clamped so huge y stays well formed.
  Plot.prototype.path=function(f,x0,x1,step){
    if(x0===undefined)x0=this.xmin; if(x1===undefined)x1=this.xmax; if(!step)step=(this.xmax-this.xmin)/400;
    var d='',pen=false,span=(this.ymax-this.ymin)*6;
    for(var x=x0;x<=x1+step*1e-6;x+=step){
      var xx=Math.min(x,x1), y=f(xx);
      if(!isFinite(y)){pen=false;continue}
      y=Math.max(this.ymin-span,Math.min(this.ymax+span,y));
      d+=(pen?'L':'M')+this.sx(xx).toFixed(1)+' '+this.sy(y).toFixed(1); pen=true;
    }
    return d;
  };
  // Background grid, axes and tick labels. ticks are [value,label] pairs; labels are plain text.
  Plot.prototype.axes=function(o){
    o=o||{}; var g=this.bg; this.clear(g);
    var gs=o.grid||[1,1], self=this;
    if(gs[0]) for(var x=Math.ceil(this.xmin/gs[0])*gs[0];x<=this.xmax;x+=gs[0]) el('line',{x1:this.sx(x),y1:0,x2:this.sx(x),y2:this.H,stroke:'#EFEEE8','stroke-width':1},g);
    if(gs[1]) for(var y=Math.ceil(this.ymin/gs[1])*gs[1];y<=this.ymax;y+=gs[1]) el('line',{x1:0,y1:this.sy(y),x2:this.W,y2:this.sy(y),stroke:'#EFEEE8','stroke-width':1},g);
    var ax=Math.min(Math.max(0,this.ymin),this.ymax), ay=Math.min(Math.max(0,this.xmin),this.xmax);
    var X0=this.sy(ax), Y0=this.sx(ay);
    el('line',{x1:4,y1:X0,x2:this.W-4,y2:X0,stroke:'#A6A6AD','stroke-width':1.4,'marker-end':'url(#'+this.id+'a)'},g);
    if(o.yaxis!==false) el('line',{x1:Y0,y1:this.H-4,x2:Y0,y2:4,stroke:'#A6A6AD','stroke-width':1.4,'marker-end':'url(#'+this.id+'a)'},g);
    function t(txt,x,y,anchor,extra){var n=el('text',{x:x,y:y,'text-anchor':anchor||'middle','font-size':o.fs||15,fill:'#8C8C94','font-family':'KaTeX_Main, serif'},g);
      for(var k in extra)n.setAttribute(k,extra[k]); n.textContent=txt; return n}
    // skip tick labels that would be cut off at the edge of the plot
    (o.xticks||[]).forEach(function(p){var X=self.sx(p[0]);if(X>16&&X<self.W-16)t(String(p[1]).replace(/-/g,'−'),X,X0+20)});
    var noY=o.yaxis===false;
    (o.yticks||[]).forEach(function(p){var Y=self.sy(p[0]);if(Y>14&&Y<self.H-10)t(String(p[1]).replace(/-/g,'−'),noY?4:Y0-8,noY?Y-5:Y+5,noY?'start':'end')});
    if(o.xlabel!==false) t(o.xlabel||'x',this.W-10,X0-10,'end',{'font-style':'italic','font-size':18});
    if(o.yaxis!==false&&o.ylabel!==false) t(o.ylabel||'y',Y0+12,18,'start',{'font-style':'italic','font-size':18});
  };
  // Mouse or touch position in graph coordinates.
  Plot.prototype.fromEvent=function(e){var r=this.svg.getBoundingClientRect();
    return {x:this.xmin+(e.clientX-r.left)/r.width*(this.xmax-this.xmin), y:this.ymax-(e.clientY-r.top)/r.height*(this.ymax-this.ymin)}};
  // Place an absolutely positioned HTML label at graph point (x,y), offset by dy pixels.
  Plot.prototype.place=function(node,x,y,dy,dx){var r=this.svg.getBoundingClientRect();
    node.style.left=(this.sx(x)/this.W*r.width+(dx||0))+'px'; node.style.top=(this.sy(y)/this.H*r.height+(dy||0))+'px'};

  // Make an SVG element draggable. onMove receives graph coordinates.
  function draggable(node,plot,onMove,onEnd){
    var on=false;
    node.addEventListener('pointerdown',function(e){on=true;node.setPointerCapture(e.pointerId);e.preventDefault()});
    node.addEventListener('pointermove',function(e){if(on)onMove(plot.fromEvent(e))});
    function end(){if(on&&onEnd)onEnd();on=false}
    node.addEventListener('pointerup',end); node.addEventListener('pointercancel',end);
    // stop the page scrolling on phones when a drag starts on the handle
    node.addEventListener('touchstart',function(e){e.preventDefault()},{passive:false});
  }

  // Wire a range input to a list of allowed values. Returns a setter.
  function bindRange(input,values,onChange){
    input.min=0; input.max=values.length-1; input.step=1;
    input.addEventListener('input',function(){onChange(values[+input.value])});
    return function(v){var best=0;for(var i=0;i<values.length;i++)if(Math.abs(values[i]-v)<Math.abs(values[best]-v))best=i;input.value=best};
  }
  function range(a,b,step){var out=[];for(var v=a;v<=b+step*1e-6;v+=step)out.push(Math.round(v/step)*step);return out}

  function ready(fn){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn();
    // KaTeX's fonts change label widths once loaded, so draw again then
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fn);
  }

  window.Kit={frac:frac,fracPi:fracPi,dec:dec,fix:fix,signed:signed,tex:tex,texAll:texAll,plain:plain,el:el,
    Plot:Plot,draggable:draggable,bindRange:bindRange,range:range,ready:ready,gcd:gcd};
})();
