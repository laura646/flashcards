export default function LessonLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl animate-pulse">
        <div className="h-4 w-24 bg-gray-200 rounded mb-6" />
        <div className="h-6 w-64 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-40 bg-gray-100 rounded mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                <div className="h-5 w-48 bg-gray-200 rounded" />
              </div>
              <div className="h-3 w-full bg-gray-100 rounded mb-2" />
              <div className="h-3 w-3/4 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
