const OPEN_LIBRARY = 'https://openlibrary.org/search.json'
const WIKI = 'https://pt.wikipedia.org/w/api.php'

export async function searchBooks(query) {
  const url = `${OPEN_LIBRARY}?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,isbn,pages_num,subject`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Não foi possível pesquisar livros agora.')
  const data = await response.json()

  return (data.docs || []).map(book => ({
    externalId: book.key,
    title: book.title || 'Sem título',
    author: book.author_name?.[0] || 'Autor desconhecido',
    year: book.first_publish_year || null,
    totalPages: book.pages_num?.[0] || null,
    isbn: book.isbn?.[0] || null,
    coverUrl: book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
      : null,
    subjects: (book.subject || []).slice(0, 8)
  }))
}

export async function enrichWithWikipedia(title, author = '') {
  const term = `${title}${author ? ` ${author}` : ''}`
  const url = `${WIKI}?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=0&gsrlimit=3&prop=extracts|pageimages&exintro=1&explaintext=1&pithumbsize=700&format=json&origin=*`
  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  const pages = Object.values(data.query?.pages || {})
  if (!pages.length) return null
  const page = pages[0]

  return {
    summary: page.extract || null,
    wikipediaUrl: `https://pt.wikipedia.org/?curid=${page.pageid}`,
    thumbnail: page.thumbnail?.source || null,
    wikipediaTitle: page.title || null
  }
}


export async function getPersonalizedRecommendations(books) {
  const library = new Set(books.map(b => (b.title || '').trim().toLowerCase()))
  const favorites = books
    .filter(b => b.status === 'completed' && Number(b.rating || 0) >= 4)
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 4)

  if (!favorites.length) return []

  const authorScore = {}
  const subjectScore = {}

  for (const book of favorites) {
    if (book.author) authorScore[book.author] = (authorScore[book.author] || 0) + Number(book.rating || 0)
    try {
      const details = await searchBooks((book.title || '') + ' ' + (book.author || ''))
      const match = details[0]
      for (const subject of (match?.subjects || []).slice(0, 6)) {
        const key = subject.toLowerCase()
        if (key.length > 2) subjectScore[key] = (subjectScore[key] || 0) + Number(book.rating || 0)
      }
    } catch {}
  }

  const topSubjects = Object.entries(subjectScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)

  const queries = []
  const topAuthor = Object.entries(authorScore).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (topAuthor) queries.push(topAuthor)
  queries.push(...topSubjects)

  const collected = []
  for (const query of queries.slice(0, 4)) {
    try {
      const found = await searchBooks(query)
      collected.push(...found)
    } catch {}
  }

  const seen = new Set()
  return collected
    .filter(book => {
      const key = (book.title || '').trim().toLowerCase()
      if (!key || library.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
}
