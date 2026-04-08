export default function AdminLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="animate-pulse flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-gray-200 rounded-2xl mb-3" />
        <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-56 bg-gray-100 rounded" />
      </div>
      <div className="w-full max-w-4xl space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-56 bg-gray-200 rounded" />
                <div className="h-3 w-40 bg-gray-100 rounded" />
              </div>
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
