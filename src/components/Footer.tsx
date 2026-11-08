import { useEffect,useRef,useState } from 'react'
import type { RefObject } from 'react'
import { content } from '../content'
import { Brand,Icon } from './ui'

export function ContactFooter({sectionRef,reduced}:{sectionRef:RefObject<HTMLElement|null>;reduced:boolean}) {
  const card=useRef<HTMLDivElement>(null)
  const [entered,setEntered]=useState(reduced)
  useEffect(()=>{
    const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setEntered(true);observer.disconnect()}},{rootMargin:'120px'})
    if(card.current)observer.observe(card.current)
    return()=>observer.disconnect()
  },[])
  const contact=content.contact,copy=content.footer
  const credits: {label:string;href?:string}[]=content.services.attribution
  const phone=contact.phone?'tel:'+contact.phone.replace(/[^\d+]/g,''):''
  const socials=[{key:'telegram' as const,href:contact.telegram},{key:'whatsapp' as const,href:contact.whatsapp},{key:'phone' as const,href:phone}].filter(item=>item.href)
  const hasContact=Object.values(contact).some(Boolean)
  return <footer ref={sectionRef} className="studio-footer" id="contact" aria-label={copy.contactsTitle}>
    <div ref={card} className={'footer-card'+(entered?' footer-entered':'')}>
      <div className="footer-about"><Brand /><p>{copy.description}</p>
        {socials.length>0&&<div className="footer-socials">{socials.map(item=><a key={item.key} href={item.href}
          aria-label={copy.socialLabels[item.key]} {...(item.key!=='phone'?{target:'_blank',rel:'noopener noreferrer'}:{})}><Icon name={item.key} size={21}/></a>)}</div>}
      </div>
      <nav className="footer-columns" aria-label={content.ui.navigation}>
        {copy.columns.map(column=><div className="footer-column" key={column.title}><h2>{column.title}</h2>
          {column.links.map(link=><a key={link.label} href={link.href}>{link.label}</a>)}
        </div>)}
        <div className="footer-column"><h2>{copy.contactsTitle}</h2>
          {phone&&<a href={phone}>{contact.phone}</a>}
          {contact.telegram&&<a href={contact.telegram} target="_blank" rel="noopener noreferrer">{copy.socialLabels.telegram}</a>}
          {contact.whatsapp&&<a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">{copy.socialLabels.whatsapp}</a>}
          {contact.address&&<span>{contact.address}</span>}{contact.hours&&<span>{contact.hours}</span>}
          {!hasContact&&<p>{copy.contactPending}</p>}
        </div>
      </nav>
      <div className="footer-word" aria-hidden="true">{content.brand}</div><div className="footer-beams" aria-hidden="true" />
    </div>
    <p className="footer-copyright">{copy.copyright}</p>
    <details className="model-credits footer-credits"><summary>{content.ui.attribution}</summary>
      <ul>{credits.map(asset=><li key={asset.label}>{asset.href?<a href={asset.href} target="_blank" rel="noopener noreferrer">{asset.label}</a>:<span>{asset.label}</span>}</li>)}</ul>
    </details>
  </footer>
}
