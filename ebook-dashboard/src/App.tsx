import { useDashboardStore } from './store'
import { Sidebar } from './components/Sidebar'
import { OverviewPage } from './pages/OverviewPage'
import { EbookPage } from './pages/EbookPage'
import { ContentPage } from './pages/ContentPage'
import { PlatformsPage } from './pages/PlatformsPage'

function App() {
  const page = useDashboardStore((s) => s.page)

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">
          {page === 'overview' && <OverviewPage />}
          {page === 'ebook' && <EbookPage />}
          {page === 'content' && <ContentPage />}
          {page === 'platforms' && <PlatformsPage />}
        </div>
      </main>
    </div>
  )
}

export default App
