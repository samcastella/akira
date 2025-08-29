'use client';

export default function ImagesTool(){
const [list, setList] = useState<Pic[]>([]);
const [busy, setBusy] = useState(false);

useEffect(() => { try { const raw = localStorage.getItem(KEY); if(raw) setList(JSON.parse(raw)); } catch {} }, []);
useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} }, [list]);

const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
const files = e.target.files; if (!files || !files.length) return;
setBusy(true);
try {
const pics: Pic[] = [];
for (const f of Array.from(files)) {
const b64 = await fileToBase64Compressed(f);
pics.push({ id: crypto.randomUUID(), b64, createdAt: Date.now() });
}
setList(prev => [...pics, ...prev]);
e.currentTarget.value = '';
} catch (err) {
alert('No se pudo procesar la imagen.');
} finally { setBusy(false); }
};

const delOne = (id: string) => setList(list.filter(p => p.id !== id));

return (
<div>
<h3 style={{marginTop:0}}>Imágenes</h3>
<p style={{color:'#666'}}>Sube fotos que quieras guardar. Se almacenan localmente y se comprimen para móvil.</p>
<div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12}}>
<label className="btn" style={{cursor:'pointer'}}>
{busy ? 'Procesando…' : 'Añadir imágenes'}
<input type="file" accept="image/*" multiple capture="environment" onChange={onPick} style={{ display: 'none' }} />
</label>
<span className="badge">{list.length} guardadas</span>
</div>

<div className="imgGrid">
{list.map(p => (
<figure key={p.id} style={{position:'relative', margin:0}}>
{/* Usamos <img> normal con base64. Totalmente compatible en Safari/Chrome móvil. */}
<img src={p.b64} alt="Imagen guardada" />
<button className="btn secondary" style={{position:'absolute', top:6, right:6}} onClick={()=>delOne(p.id)}>Borrar</button>
</figure>
))}
</div>
</div>
);
}