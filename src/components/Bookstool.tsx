'use client';
</section>

{/* Próximos libros */}
<section className="card" style={{marginTop:12}}>
<h4 style={{margin:'0 0 8px'}}>Libros que quiero leer</h4>
<div className="rows">
<input className="input" placeholder="Nombre del libro *" value={formW.title} onChange={e=>setFormW({...formW, title:e.target.value})} />
<input className="input" placeholder="Autor (opcional)" value={formW.author} onChange={e=>setFormW({...formW, author:e.target.value})} />
<textarea className="textarea" placeholder="Notas (opcional)" value={formW.notes} onChange={e=>setFormW({...formW, notes:e.target.value})} />
<div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
<button className="btn" onClick={addWishlist}>{store.wishlist.length? 'Actualizar' : 'Guardar'}</button>
</div>
</div>
<ul className="list" style={{marginTop:12}}>
{store.wishlist.map(b => (
<li key={b.id} style={{padding:'10px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
<div>
<strong>{b.title}</strong>{b.author?` · ${b.author}`:''}
{b.notes && <div style={{color:'#666', marginTop:4}}>{b.notes}</div>}
</div>
<button className="btn" onClick={()=>startFromWishlist(b.id)}>Empezar a leer</button>
</li>
))}
</ul>
</section>

{/* Terminados */}
<section className="card" style={{marginTop:12}}>
<h4 style={{margin:'0 0 8px'}}>Libros terminados</h4>
<ul className="list">
{store.finished.length===0 && <li style={{padding:'8px 0', color:'#777'}}>Aún no hay libros terminados.</li>}
{store.finished.map(b => (
<li key={b.id} style={{padding:'10px 0'}}>
<div><strong>{b.title}</strong>{b.author?` · ${b.author}`:''}</div>
<small style={{color:'#666'}}>Terminado el {new Date(b.finishedAt).toLocaleDateString()}</small>
{b.notes && <div style={{color:'#666', marginTop:4}}>{b.notes}</div>}
</li>
))}
</ul>
</section>

{showModal.open && (
<div className="modal-backdrop" onClick={closeModal}>
<div className="modal" onClick={e=>e.stopPropagation()}>
<h4 style={{margin:'0 0 6px'}}>Vas a empezar un nuevo libro 📚</h4>
<p>¡Es una excelente noticia! Te estás convirtiendo en un gran lector. ¿Te gustaría anunciar al mundo el libro que vas a comenzar? Eso reforzará tu deseo de hacerlo y puede motivar a los demás a seguir tu camino.</p>
<div className="actions">
<a href={shareLinks.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
<a href={shareLinks.twitter} target="_blank" rel="noreferrer">Twitter/X</a>
<a href={shareLinks.facebook} target="_blank" rel="noreferrer">Facebook</a>
<a href={shareLinks.instagram} target="_blank" rel="noreferrer">Instagram</a>
<a href={shareLinks.tiktok} target="_blank" rel="noreferrer">TikTok</a>
<button className="btn" onClick={()=>{ showModal.onConfirm(); closeModal(); }}>Vamos a por ello</button>
</div>
</div>
</div>
)}
</div>
);
}