export function MetricBand({items}:{items:{value:string|number;label:string;hint?:string}[]}){
  return <section className="metric-band" aria-label="Indicadores">{items.map((item)=><div className="metric" key={item.label}><div className="value">{item.value}</div><div className="label">{item.label}</div>{item.hint&&<div className="hint">{item.hint}</div>}</div>)}</section>
}
