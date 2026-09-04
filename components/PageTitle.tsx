export function PageTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:React.ReactNode}){
  return <header className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div>{action}</div>}</header>
}
