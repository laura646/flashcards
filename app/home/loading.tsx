export default function HomeLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="animate-pulse flex flex-col items-center mb-8">
        <div className="w-32 h-32 bg-gray-200 rounded-2xl mb-2" />
        <div className="h-3 w-56 bg-gray-200 rounded mb-3" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </div>
      <div className="w-full max-w-lg space-y-3">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-3 w-32 bg-gray-100 rounded" />
              </div>
              <div className="h-8 w-8 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
