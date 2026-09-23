const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export function renderStorefront(template,state){
  let html=template;
  for(const [key,value] of Object.entries(state.content))html=html.replace(new RegExp(`(<[^>]+data-content="${key}"[^>]*>)[\\s\\S]*?(</(?:p|span)>)`),(_match,start,end)=>start+escape(value)+end);
  for(const p of state.products){
    html=html.replace(new RegExp(`<article class="product-card [^"]+" id="${p.id}">[\\s\\S]*?</article>`),card=>{
      if(!p.published)return '';
      return card.replace(/<h3>[\s\S]*?<\/h3>/,()=>`<h3>${escape(p.name)}</h3>`)
        .replace(/<p data-product-description>[\s\S]*?<\/p>/,()=>`<p data-product-description>${escape(p.description)}</p>`)
        .replace(/(data-price="[^"]+">)[^<]+/,(_,start)=>start+money(p.priceCents))
        .replace(/(data-per-serving="[^"]+">)[^<]+/,(_,start)=>start+money(p.priceCents/25)+' per sachet')
        .replace(/(data-once-price>)[^<]+/,(_,start)=>start+money(p.priceCents))
        .replace(/(data-subscription-price>)[^<]+/,(_,start)=>start+money(p.subscriptionPriceCents))
        .replace(/(data-renewal-price>)[^<]+/,(_,start)=>start+money(p.subscriptionPriceCents))
        .replace(/(data-savings>)[^<]+/,(_,start)=>start+money(p.priceCents-p.subscriptionPriceCents));
    });
  }
  if(!state.products.some(p=>p.published))html=html.replace('<div class="product-grid">','<p class="store-note">Our gummies are temporarily unavailable. Please check back soon.</p><div class="product-grid">');
  return html;
}
