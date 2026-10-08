import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BookOpen, Bookmark, CheckCircle2, CircleUserRound, Compass, Flame,
  LibraryBig, LogIn, LogOut, Plus, Search, Sparkles, Star, Target,
  Trophy, X, CalendarDays, MessageCircle, ArrowUpRight, Clock3
} from 'lucide-react'
import { supabase, supabaseConfigured } from './supabase'
import { enrichWithWikipedia, getPersonalizedRecommendations, searchBooks } from './api'
import './styles.css'

const demoBooks = [
  {id:'demo1',title:'O Hobbit',author:'J. R. R. Tolkien',cover_url:'https://covers.openlibrary.org/b/id/6979861-L.jpg',total_pages:310,current_page:176,status:'reading',rating:null,notes:'',priority:'normal',summary:'Um hobbit é envolvido em uma grande aventura rumo à Montanha Solitária.',started_at:'2026-10-01',completed_at:null},
  {id:'demo2',title:'1984',author:'George Orwell',cover_url:'https://covers.openlibrary.org/b/id/7222246-L.jpg',total_pages:328,current_page:0,status:'future',rating:null,notes:'',priority:'high',summary:'Romance distópico sobre vigilância, poder e controle social.',started_at:null,completed_at:null},
  {id:'demo3',title:'O Pequeno Príncipe',author:'Antoine de Saint-Exupéry',cover_url:'https://covers.openlibrary.org/b/id/108684-L.jpg',total_pages:96,current_page:96,status:'completed',rating:5,notes:'Leitura que quero revisitar.',priority:'low',summary:'Uma narrativa poética sobre amizade, afeto e olhar para o essencial.',started_at:'2026-09-10',completed_at:'2026-09-12'}
]

const pct = b => b.total_pages ? Math.min(100, Math.round(Number(b.current_page || 0) / Number(b.total_pages) * 100)) : 0
const todayISO = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
const normalizeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
const dateBR = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

function App() {
  const [session,setSession] = useState(null)
  const [loading,setLoading] = useState(true)
  const [authMode,setAuthMode] = useState('login')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [authMessage,setAuthMessage] = useState('')
  const [tab,setTab] = useState('dashboard')
  const [books,setBooks] = useState(supabaseConfigured ? [] : demoBooks)
  const [query,setQuery] = useState('')
  const [results,setResults] = useState([])
  const [searching,setSearching] = useState(false)
  const [modal,setModal] = useState(false)
  const [selected,setSelected] = useState(null)
  const [toast,setToast] = useState('')
  const [recommendations,setRecommendations] = useState([])
  const [recommendLoading,setRecommendLoading] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false) })
    const {data:l} = supabase.auth.onAuthStateChange((_e,s) => setSession(s))
    return () => l.subscription.unsubscribe()
  },[])

  useEffect(() => { if (session?.user) loadBooks() },[session?.user?.id])
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3000)
      return () => clearTimeout(t)
    }
  },[toast])

  const reading = books.filter(b => b.status === 'reading')
  const future = books.filter(b => b.status === 'future')
  const completed = books.filter(b => b.status === 'completed')
  const pages = books.reduce((s,b) => s + Number(b.current_page || 0), 0)
  const pagesRead = books.reduce((sum,b) => {
    if (b.status === 'future') return sum
    const currentPage = Number(b.current_page || 0)
    const totalPages = Number(b.total_pages || 0)
    return sum + (b.status === 'completed' ? Math.max(currentPage,totalPages) : currentPage)
  }, 0)
  const totalBooks = books.length
  const completionRate = totalBooks ? Math.round((completed.length / totalBooks) * 100) : 0
  const rated = completed.filter(b => Number(b.rating || 0) > 0)
  const avg = rated.length ? (rated.reduce((s,b) => s + Number(b.rating || 0),0) / rated.length).toFixed(1) : '—'
  const xp = pages + completed.length * 120 + reading.reduce((s,b) => s + pct(b) * 2,0)
  const level = Math.floor(xp / 500) + 1
  const tasteKey = completed.map(b => (b.rating || 0)).join('|')

  useEffect(() => {
    if (!books.length || !completed.length) { setRecommendations([]); return }
    let cancelled = false
    setRecommendLoading(true)
    getPersonalizedRecommendations(books)
      .then(data => { if (!cancelled) setRecommendations(data) })
      .catch(() => { if (!cancelled) setRecommendations([]) })
      .finally(() => { if (!cancelled) setRecommendLoading(false) })
    return () => { cancelled = true }
  },[books.length, tasteKey])

  async function loadBooks() {
    const {data,error} = await supabase.from('books').select('*').order('updated_at',{ascending:false})
    if (error) setToast(error.message)
    else setBooks(data || [])
  }

  async function auth(e) {
    e.preventDefault()
    setAuthMessage('')
    const r = authMode === 'login'
      ? await supabase.auth.signInWithPassword({email,password})
      : await supabase.auth.signUp({email,password})
    if (r.error) setAuthMessage(r.error.message)
    else if (authMode === 'signup') setAuthMessage('Conta criada. Confira seu e-mail se a confirmação estiver ativa.')
  }

  async function search(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try { setResults(await searchBooks(query)) }
    catch (err) { setToast(err.message) }
    finally { setSearching(false) }
  }

  async function importBook(b) {
    setSearching(true)
    let w = null
    try { w = await enrichWithWikipedia(b.title,b.author) } catch {}
    setSelected({
      title:b.title,author:b.author,isbn:b.isbn,cover_url:b.coverUrl || w?.thumbnail,
      summary:w?.summary || '',wikipedia_url:w?.wikipediaUrl || '',total_pages:b.totalPages || '',
      current_page:0,status:'future',priority:'normal',notes:'',rating:'',
      started_at:'',completed_at:''
    })
    setResults([])
    setModal(true)
    setSearching(false)
  }

  async function saveBook(form) {
    const status = form.status || 'future'
    const p = {
      ...form,
      title:(form.title || '').trim(),
      total_pages:form.total_pages ? Number(form.total_pages) : null,
      current_page:form.current_page ? Number(form.current_page) : 0,
      rating:status === 'completed' && form.rating !== '' ? Number(form.rating) : null,
      started_at:status !== 'future' ? (normalizeDate(form.started_at) || todayISO()) : normalizeDate(form.started_at),
      completed_at:status === 'completed' ? (normalizeDate(form.completed_at) || todayISO()) : null,
      user_id:session?.user?.id
    }
    if (!p.title) { setToast('Informe o título do livro.'); return }
    if (p.total_pages && p.current_page > p.total_pages) p.current_page = p.total_pages
    if (!supabaseConfigured) {
      setBooks(x => selected?.id ? x.map(b => b.id === selected.id ? {...b,...p} : b) : [{...p,id:'demo'+Date.now()},...x])
      setModal(false); setToast('Livro salvo.'); return
    }
    const r = selected?.id
      ? await supabase.from('books').update(p).eq('id',selected.id)
      : await supabase.from('books').insert(p)
    if (r.error) setToast(r.error.message)
    else { setModal(false); setToast('Livro salvo.'); loadBooks() }
  }

  async function updateBook(id,p) {
    if (!supabaseConfigured) { setBooks(x => x.map(b => b.id===id ? {...b,...p} : b)); return }
    const r = await supabase.from('books').update(p).eq('id',id)
    if (r.error) setToast(r.error.message)
    else loadBooks()
  }

  async function removeBook(id) {
    if (!confirm('Excluir este livro?')) return
    if (!supabaseConfigured) { setBooks(x => x.filter(b => b.id!==id)); return }
    const r = await supabase.from('books').delete().eq('id',id)
    if (r.error) setToast(r.error.message)
    else loadBooks()
  }

  if (loading) return <div className="loading">Carregando seu universo de leitura…</div>
  if (supabaseConfigured && !session) return <Auth {...{authMode,setAuthMode,email,setEmail,password,setPassword,authMessage,auth}}/>

  const nav = [
    ['dashboard','Visão geral',Compass],
    ['reading','Estou lendo',BookOpen],
    ['future','Futuras leituras',Bookmark],
    ['completed','Concluídos',CheckCircle2],
    ['progression','Progressão',Trophy]
  ]
  const title = {dashboard:'Visão geral',reading:'Estou lendo',future:'Futuras leituras',completed:'Livros concluídos',progression:'Sua jornada'}[tab]
  const list = tab==='reading' ? reading : tab==='future' ? future : tab==='completed' ? completed : []

  return <div className="shell">
    <aside className="side">
      <div className="brand">
        <div className="logo"><BookOpen/></div>
        <div><b>Reading Nexus</b><small>painel pessoal</small></div>
      </div>
      <nav>{nav.map(([id,label,I]) => <button className={tab===id?'nav active':'nav'} onClick={()=>setTab(id)} key={id}><I size={18}/><span>{label}</span><em>{id==='reading'?reading.length:id==='future'?future.length:id==='completed'?completed.length:''}</em></button>)}</nav>
      <div className="sideBottom">
        <div className="level"><span>Nível {level}</span><b>{xp} XP</b><div className="bar"><i style={{width:(xp%500)/5+'%'}}/></div><small>{500-xp%500} XP para o próximo nível</small></div>
        <div className="user"><CircleUserRound size={19}/><span>{session?.user?.email || 'Modo demonstração'}</span></div>
        {supabaseConfigured && <button className="ghost" onClick={()=>supabase.auth.signOut()}><LogOut size={15}/> Sair</button>}
      </div>
    </aside>

    <main>
      <header>
        <div><label>CENTRAL DE LEITURA</label><h1>{tab==='dashboard' ? 'Seu universo de livros.' : title}</h1><p>{tab==='dashboard' ? 'Tudo o que está acontecendo na sua biblioteca, em um só lugar.' : tab==='reading' ? 'Acompanhe exatamente onde você parou.' : tab==='future' ? 'Sua fila de próximas aventuras.' : tab==='completed' ? 'Seu histórico e suas avaliações.' : 'Acompanhe sua experiência, seus níveis e os próximos marcos.'}</p></div>
        <button className="primary" onClick={()=>{setSelected(null);setModal(true)}}><Plus size={18}/> Adicionar livro</button>
      </header>

      <section className="search">
        <div className="searchLabel"><Sparkles size={16}/> Encontrar um livro</div>
        <form onSubmit={search}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Título, autor ou ISBN…"/><button disabled={searching}>{searching?'Pesquisando…':'Pesquisar'}</button></form>
        {results.length>0 && <div className="results">{results.map((r,i)=><button key={i} onClick={()=>importBook(r)}><Cover src={r.coverUrl}/><span><b>{r.title}</b><small>{r.author}{r.year?' · '+r.year:''}</small></span><ArrowUpRight size={17}/></button>)}</div>}
      </section>

      {tab==='dashboard'
        ? <Dashboard {...{reading,future,completed,pagesRead,totalBooks,completionRate,avg,level,xp,recommendations,recommendLoading,setTab,setSelected,setModal}}/>
        : tab==='progression'
          ? <Progression level={level} xp={xp} booksCompleted={completed.length} pagesRead={pagesRead}/>
          : list.length
          ? <div className="grid">{list.map(b=><BookCard key={b.id} book={b} update={updateBook} remove={removeBook} edit={()=>{setSelected(b);setModal(true)}}/>)}</div>
          : <Empty tab={tab} onAdd={()=>{setSelected(null);setModal(true)}}/>
      }
    </main>

    {modal && <BookModal book={selected} close={()=>setModal(false)} save={saveBook} notify={setToast}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function Dashboard({reading,future,completed,pagesRead,totalBooks,completionRate,avg,level,xp,recommendations,recommendLoading,setTab,setSelected,setModal}) {
  const current = reading[0]
  const favorite = completed.slice().sort((a,b)=>Number(b.rating||0)-Number(a.rating||0))[0]
  const progress = current ? pct(current) : 0
  return <div className="home">
    <div className="stats">
      <Stat icon={BookOpen} label="Estou lendo" value={reading.length}/>
      <Stat icon={Bookmark} label="Na fila" value={future.length}/>
      <Stat icon={CheckCircle2} label="Concluídos" value={completed.length}/>
      <Stat icon={Star} label="Nota média" value={avg}/>
    </div>

    <section className="libraryProgress card" aria-label="Progresso da biblioteca">
      <div className="sectionHead"><div><label>VISÃO DA BIBLIOTECA</label><h3>Seu progresso geral</h3><p>{totalBooks} {totalBooks === 1 ? 'livro cadastrado' : 'livros cadastrados'} · {completionRate}% concluído</p></div><div className="libraryCount"><BookOpen size={16}/><strong>{completed.length}/{totalBooks}</strong></div></div>
      <div className="libraryBar" role="img" aria-label={`${completionRate}% dos livros concluídos`}><span style={{width:completionRate+'%'}}/></div>
      <div className="libraryLegend">
        <span><i className="legendDot doneDot"/>Concluídos <b>{completed.length}</b></span>
        <span><i className="legendDot readingDot"/>Em andamento <b>{reading.length}</b></span>
        <span><i className="legendDot futureDot"/>Na fila <b>{future.length}</b></span>
      </div>
    </section>

    <section className="overviewHero card">
      <div className="heroGlow"/>
      <div className="heroCopy">
        <div className="eyebrow"><LibraryBig size={15}/> SUA LEITURA AGORA</div>
        {current ? <><h2>{current.title}</h2><p className="heroAuthor">{current.author}</p><div className="heroMeta"><span>{current.current_page||0} de {current.total_pages||'—'} páginas</span><b>{progress}%</b></div><div className="bar heroBar"><i style={{width:progress+'%'}}/></div><div className="heroDates">{current.started_at && <span><CalendarDays size={13}/> Desde {dateBR(current.started_at)}</span>}{current.completed_at && <span>Concluído em {dateBR(current.completed_at)}</span>}</div><button className="secondary" onClick={()=>setTab('reading')}>Continuar leitura <ArrowUpRight size={15}/></button></>
        : <><h2>A próxima história começa aqui.</h2><p className="heroAuthor">Você ainda não tem um livro em andamento.</p><button className="secondary" onClick={()=>setTab('future')}>Escolher uma futura leitura</button></>}
      </div>
      <div className="heroCover">{current ? <img src={current.cover_url} onError={e=>e.currentTarget.style.display='none'}/> : <BookOpen size={45}/>} {current && <div className="coverProgress"><span>PROGRESSO</span><b>{progress}%</b></div>}</div>
    </section>

    <div className="homeColumns">
      <section className="card activityCard">
        <div className="sectionHead"><div><label>SEU MOMENTO</label><h3>Atividade da biblioteca</h3></div><Clock3 size={18}/></div>
        <div className="activityList">
          {reading.slice(0,2).map(b=><div className="activity" key={b.id}><div className="activityIcon"><BookOpen size={15}/></div><div><b>Você está lendo {b.title}</b><small>{pct(b)}% concluído · {b.current_page||0} páginas</small></div></div>)}
          {completed.slice(0,2).map(b=><div className="activity" key={b.id}><div className="activityIcon done"><CheckCircle2 size={15}/></div><div><b>Você concluiu {b.title}</b><small>{b.rating ? 'Avaliação: '+b.rating+' / 5' : 'Livro concluído'}</small></div></div>)}
          {!reading.length && !completed.length && <div className="activityEmpty"><MessageCircle size={23}/><p>Seu histórico começa com a primeira leitura.</p></div>}
        </div>
      </section>

      <section className="card tasteCard">
        <div className="sectionHead"><div><label>SEU PERFIL</label><h3>Identidade de leitor</h3></div><Sparkles size={18}/></div>
        {favorite ? <><div className="tasteBook"><Cover src={favorite.cover_url}/><div><b>{favorite.title}</b><small>Seu livro mais bem avaliado</small><RatingStars value={favorite.rating||0} disabled/></div></div><div className="tasteStats"><span><strong>{pagesRead.toLocaleString('pt-BR')}</strong><small>Páginas lidas (estimativa)</small></span><span><strong>Nível {level}</strong><small>{xp} XP acumulados</small></span></div></> :
        <div className="tasteEmpty"><Target size={25}/><p>Conclua e avalie seus primeiros livros para eu começar a entender seu gosto.</p></div>}
      </section>
    </div>

    <section className="card recommendCard">
      <div className="sectionHead"><div><label>DESCUBRA ALGO NOVO</label><h3>Recomendações para você</h3><p>Baseadas no que você lê e avalia.</p></div><div className="recommendBadge"><Sparkles size={14}/> beta</div></div>
      {!completed.length ? <div className="recommendEmpty"><Sparkles size={22}/><span>Termine e avalie um livro para desbloquear recomendações personalizadas.</span></div>
      : recommendLoading ? <div className="recommendEmpty"><Sparkles size={22}/><span>Entendendo seus gostos…</span></div>
      : recommendations.length ? <div className="recommendGrid">{recommendations.map((b,i)=><button className="recommend" key={i} onClick={()=>{setSelected({title:b.title,author:b.author,isbn:b.isbn,cover_url:b.coverUrl,summary:'',wikipedia_url:'',total_pages:b.totalPages||'',current_page:0,status:'future',priority:'normal',notes:'',rating:'',started_at:'',completed_at:''});setModal(true)}}><div className="recCover"><Cover src={b.coverUrl}/></div><div className="recBody"><small>RECOMENDADO</small><b>{b.title}</b><span>{b.author}</span><em>{(b.subjects||[]).slice(0,2).join(' · ')}</em></div><ArrowUpRight size={16}/></button>)}</div>
      : <div className="recommendEmpty"><Sparkles size={22}/><span>Ainda não encontrei sugestões suficientes. Avalie mais livros para refinar seu perfil.</span></div>}
    </section>

    <div className="achievement"><div><label>PROGRESSÃO</label><h3>{level < 2 ? 'Comece sua jornada' : 'Você está construindo um histórico'}</h3><p>Nível {level} · {xp} XP. Cada página registrada conta para sua evolução.</p></div><div className="badge"><Trophy size={20}/><span>{500-(xp%500)} XP para o próximo nível</span></div></div>
  </div>
}

function Progression({level,xp,booksCompleted,pagesRead}) {
  const progress = xp % 500
  const remaining = 500 - progress
  const character = level >= 50
    ? {name:'Arquimago',rank:'LENDÁRIO',description:'O domínio máximo desta versão do Nexus.',icon:'✦',tone:'mage'}
    : level >= 20
      ? {name:'Imperador',rank:'ELITE',description:'Sua disciplina já construiu um império de conhecimento.',icon:'♛',tone:'emperor'}
      : level >= 10
        ? {name:'Vampiro',rank:'DESPERTADO',description:'Uma presença noturna, guiada pela sede de conhecimento.',icon:'☾',tone:'vampire'}
        : {name:'Aprendiz',rank:'INICIANTE',description:'Toda grande jornada começa com a primeira página.',icon:'✧',tone:'apprentice'}
  const milestones = [
    {level:1,name:'Aprendiz',description:'O início da jornada',icon:'✧',tone:'apprentice'},
    {level:10,name:'Vampiro',description:'Desperta a noite',icon:'☾',tone:'vampire'},
    {level:20,name:'Imperador',description:'Conquista seu império',icon:'♛',tone:'emperor'},
    {level:50,name:'Arquimago',description:'Ápice desta versão',icon:'✦',tone:'mage'}
  ]
  return <div className="progressionPage">
    <section className={`characterHero card ${character.tone}`}>
      <div className="characterAura"/>
      <div className="characterCopy">
        <label>SEU PERSONAGEM ATUAL · {character.rank}</label>
        <h2>{character.name}</h2>
        <p>{character.description}</p>
        <div className="characterLevel"><span>NÍVEL ATUAL</span><strong>{level}</strong><span className="xpPill">{xp.toLocaleString('pt-BR')} XP</span></div>
      </div>
      <div className="characterSigil" aria-hidden="true"><span>{character.icon}</span><small>NEXUS</small></div>
    </section>

    <section className="card xpPanel">
      <div className="sectionHead"><div><label>SUA EXPERIÊNCIA</label><h3>Próximo nível</h3><p>Você ganha XP conforme avança nas leituras.</p></div><div className="xpLevelBadge">NÍVEL {level}</div></div>
      <div className="xpNumbers"><strong>{progress.toLocaleString('pt-BR')} <span>/ 500 XP</span></strong><b>{remaining.toLocaleString('pt-BR')} XP restantes</b></div>
      <div className="xpTrack" role="img" aria-label={`${Math.round(progress/5)}% da experiência para o próximo nível`}><span style={{width:(progress/5)+'%'}}/></div>
      <div className="xpFoot"><span><BookOpen size={14}/> Páginas lidas: {pagesRead.toLocaleString('pt-BR')}</span><span><CheckCircle2 size={14}/> Livros concluídos: {booksCompleted}</span></div>
    </section>

    <section className="card milestonesPanel">
      <div className="sectionHead"><div><label>CAMINHO DE EVOLUÇÃO</label><h3>Marcos de personagem</h3><p>Continue lendo para revelar novas formas da sua jornada.</p></div><Trophy size={19}/></div>
      <div className="milestoneGrid">{milestones.map(item => {
        const unlocked = level >= item.level
        return <article className={`milestone ${item.tone} ${unlocked?'unlocked':'locked'}`} key={item.level}>
          <div className="milestoneIcon">{unlocked ? item.icon : '🔒'}</div>
          <div className="milestoneLevel">NÍVEL {item.level}</div>
          <h4>{item.name}</h4>
          <p>{item.description}</p>
          <span className="milestoneState">{unlocked ? 'DESBLOQUEADO' : `${item.level-level} níveis restantes`}</span>
        </article>
      })}</div>
    </section>
    <p className="progressionNote">Primeira versão: a tela já acompanha o XP e o nível atuais do Reading Nexus. Os personagens são marcos visuais; a regra de XP existente foi preservada.</p>
  </div>
}

function Stat({icon:I,label,value}){return <div className="stat card"><I size={19}/><span>{label}</span><b>{value}</b></div>}
function Cover({src}){return <div className="cover">{src ? <img src={src} onError={e=>e.currentTarget.style.display='none'}/> : <BookOpen size={28}/>}</div>}
function RatingStars({value=0,onChange,disabled=false}){return <div className={disabled?'stars disabled':'stars'} aria-label={value ? value+' de 5 estrelas' : 'Sem avaliação'}>{[1,2,3,4,5].map(n=><button type="button" key={n} className={n<=Number(value)?'star active':'star'} onClick={()=>!disabled&&onChange?.(n)} disabled={disabled}><Star size={18} fill={n<=Number(value)?'currentColor':'none'}/></button>)}</div>}
function BookCard({book,update,remove,edit}){const advance=()=>{const next=book.status==='future'?'reading':'completed';update(book.id,{status:next,current_page:next==='completed'&&book.total_pages?book.total_pages:book.current_page,started_at:next!=='future'?(book.started_at||todayISO()):book.started_at,completed_at:next==='completed'?(book.completed_at||todayISO()):null})};return <article className="book"><Cover src={book.cover_url}/><div className="bookBody"><div className="meta"><span>{book.status==='completed'?'CONCLUÍDO':book.status==='reading'?'LENDO':'NA FILA'}</span>{book.status==='completed'&&<RatingStars value={book.rating||0} disabled/>}</div><h3>{book.title}</h3><p>{book.author}</p>{book.total_pages&&<><div className="progressText"><b>{pct(book)}%</b><span>{book.current_page||0}/{book.total_pages}</span></div><div className="bar"><i style={{width:pct(book)+'%'}}/></div></>}{(book.started_at||book.completed_at)&&<div className="dates">{book.started_at&&<span>Início: {dateBR(book.started_at)}</span>}{book.completed_at&&<span>Fim: {dateBR(book.completed_at)}</span>}</div>}{book.summary&&<div className="summary">{book.summary}</div>}<div className="actions"><button className="secondary" onClick={edit}>Editar</button>{book.status!=='completed'&&<button className="icon" title="Avançar status" onClick={advance}><CheckCircle2 size={17}/></button>}<button className="icon danger" onClick={()=>remove(book.id)}><X size={17}/></button></div></div></article>}
function Empty({tab,onAdd}){return <div className="empty card"><div className="emptyIcon"><Trophy/></div><h2>{tab==='completed'?'Ainda não há conquistas aqui.':'Sua estante está esperando.'}</h2><p>Adicione um livro e comece a construir seu histórico.</p><button className="primary" onClick={onAdd}><Plus size={17}/> Adicionar livro</button></div>}

function BookModal({book,close,save,notify}){
  const [f,setF]=useState({title:'',author:'',isbn:'',cover_url:'',summary:'',wikipedia_url:'',total_pages:'',current_page:0,status:'future',priority:'normal',rating:'',notes:'',started_at:'',completed_at:'',...book})
  const [view,setView]=useState('details')
  const [entries,setEntries]=useState([])
  const [entryText,setEntryText]=useState('')
  const [entryPage,setEntryPage]=useState('')
  const [entryLoading,setEntryLoading]=useState(false)
  const set=(k,v)=>setF(x=>({...x,[k]:v}))

  useEffect(()=>{setF({title:'',author:'',isbn:'',cover_url:'',summary:'',wikipedia_url:'',total_pages:'',current_page:0,status:'future',priority:'normal',rating:'',notes:'',started_at:'',completed_at:'',...book});setView('details');setEntryText('');setEntryPage('');if(book?.id) loadEntries(book.id);else setEntries([])},[book?.id])

  async function loadEntries(id){
    if(!supabaseConfigured){setEntries([]);return}
    const {data,error}=await supabase.from('book_entries').select('*').eq('book_id',id).order('created_at',{ascending:true})
    if(error && error.code!=='42P01') setEntries([])
    else setEntries(data || [])
  }

  async function addEntry(){
    if(!entryText.trim() || !book?.id || !supabaseConfigured) return
    setEntryLoading(true)
    const payload={book_id:book.id,user_id:book.user_id,content:entryText.trim(),page_number:entryPage ? Number(entryPage) : null}
    const {data,error}=await supabase.from('book_entries').insert(payload).select('*').single()
    if(error) notify(error.code==='42P01'?'Execute a migração do Diário no Supabase para ativar este recurso.':error.message)
    else {setEntries(x=>[...x,data]);setEntryText('');setEntryPage('')}
    setEntryLoading(false)
  }

  async function deleteEntry(id){
    if(!confirm('Excluir esta entrada do diário?')) return
    const {error}=await supabase.from('book_entries').delete().eq('id',id)
    if(error) notify(error.message); else setEntries(x=>x.filter(e=>e.id!==id))
  }

  const modalStatusChange = value => setF(x=>({...x,status:value,rating:value==='completed'?x.rating:'',started_at:value!=='future'?(x.started_at||todayISO()):x.started_at,completed_at:value==='completed'?(x.completed_at||todayISO()):''}))

  return <div className="backdrop"><div className="modal modalLarge">
    <div className="modalHead"><div><label>{f.status==='completed'?'LIVRO CONCLUÍDO':'DETALHES DO LIVRO'}</label><h2>{book?'Editar livro':'Adicionar livro'}</h2></div><button className="icon" onClick={close}><X/></button></div>
    <div className="modalTabs"><button className={view==='details'?'modalTab active':'modalTab'} onClick={()=>setView('details')}><BookOpen size={16}/> Detalhes</button>{book?.id&&<button className={view==='diary'?'modalTab active':'modalTab'} onClick={()=>setView('diary')}><MessageCircle size={16}/> Diário <span>{entries.length}</span></button>}</div>
    {view==='details' ? <div className="modalLayout"><div className="modalCover"><Cover src={f.cover_url}/>{f.status==='completed'&&<div className="modalRatingPreview"><RatingStars value={f.rating||0} disabled/></div>}</div><div className="form"><div className="fields">
      <label>Título<input value={f.title||''} onChange={e=>set('title',e.target.value)}/></label>
      <label>Autor<input value={f.author||''} onChange={e=>set('author',e.target.value)}/></label>
      <label>Páginas<input type="number" value={f.total_pages||''} onChange={e=>set('total_pages',e.target.value)}/></label>
      <label>Página atual<input type="number" min="0" value={f.current_page||0} onChange={e=>set('current_page',e.target.value)}/></label>
      <label>Status<select value={f.status} onChange={e=>modalStatusChange(e.target.value)}><option value="future">Futura leitura</option><option value="reading">Estou lendo</option><option value="completed">Concluído</option></select></label>
      <label>Prioridade<select value={f.priority} onChange={e=>set('priority',e.target.value)}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label>
      <label>Data de início<input type="date" value={f.started_at||''} onChange={e=>set('started_at',e.target.value)}/></label>
      <label>Data de conclusão<input type="date" value={f.completed_at||''} disabled={f.status!=='completed'} onChange={e=>set('completed_at',e.target.value)}/></label>
      <label>Nota<div className="ratingField"><RatingStars value={f.rating||0} disabled={f.status!=='completed'} onChange={n=>set('rating',n)}/><small>{f.status!=='completed'?'Disponível depois de concluir.':f.rating?f.rating+' de 5':'Clique para avaliar'}</small></div></label>
      <label>ISBN<input value={f.isbn||''} onChange={e=>set('isbn',e.target.value)}/></label>
      <label className="wide">Capa (URL)<input value={f.cover_url||''} onChange={e=>set('cover_url',e.target.value)}/></label>
      <label className="wide">Resumo<textarea rows="4" value={f.summary||''} onChange={e=>set('summary',e.target.value)}/></label>
      <label className="wide">Suas notas<textarea rows="5" value={f.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Anotações gerais sobre o livro…"/></label>
    </div><div className="modalFoot"><button className="ghost" onClick={close}>Cancelar</button><button className="primary" onClick={()=>save(f)}>Salvar livro</button></div></div></div>
    : <div className="diary"><div className="diaryIntro"><div><label>DIÁRIO DA LEITURA</label><h3>Escreva como se fosse uma thread.</h3><p>Registre pensamentos, reações, teorias e momentos marcantes enquanto lê.</p></div><div className="diaryIcon"><MessageCircle/></div></div>{entries.length?<div className="thread">{entries.map(e=><div className="threadItem" key={e.id}><div className="threadLine"/><div className="threadDot"/><div className="threadCard"><div className="threadMeta"><span>{dateBR(e.created_at?.slice(0,10))}</span>{e.page_number&&<span>p. {e.page_number}</span>}</div><p>{e.content}</p><button className="deleteEntry" onClick={()=>deleteEntry(e.id)}>Excluir</button></div></div>)}</div>:<div className="diaryEmpty"><MessageCircle size={25}/><p>Nenhuma entrada ainda. Escreva a primeira.</p></div>}<div className="composer"><textarea value={entryText} onChange={e=>setEntryText(e.target.value)} rows="4" placeholder="O que está passando pela sua cabeça agora?"/><div className="composerFoot"><input type="number" min="1" placeholder="Página (opcional)" value={entryPage} onChange={e=>setEntryPage(e.target.value)}/><button className="primary" onClick={addEntry} disabled={entryLoading||!entryText.trim()}><MessageCircle size={16}/>{entryLoading?'Publicando…':'Publicar entrada'}</button></div></div></div>}
    </div>
  </div>
}


function Auth({authMode,setAuthMode,email,setEmail,password,setPassword,authMessage,auth}){return <div className="auth"><div className="authCard"><div className="authBrand"><div className="logo"><BookOpen/></div><b>Reading Nexus</b></div><label>SEU UNIVERSO DE LEITURA</label><h1>{authMode==='login'?'Bem-vindo de volta.':'Criar sua conta.'}</h1><p>Seu histórico acompanha você em qualquer lugar.</p><form onSubmit={auth}><input type="email" placeholder="Seu e-mail" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required minLength="6"/><button className="primary" type="submit"><LogIn size={17}/>{authMode==='login'?'Entrar':'Criar conta'}</button></form>{authMessage&&<div className="message">{authMessage}</div>}<button className="link" onClick={()=>setAuthMode(authMode==='login'?'signup':'login')}>{authMode==='login'?'Ainda não tenho uma conta':'Já tenho uma conta'}</button><small className="authNote">Depois da configuração inicial, mantenha o cadastro de novos usuários desativado.</small></div></div>}

function ToastBridge(){return null}

createRoot(document.getElementById('root')).render(<App/>)
