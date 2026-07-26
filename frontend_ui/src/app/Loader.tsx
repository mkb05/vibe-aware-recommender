// frontend_ui/components/Loader.tsx
export default function Loader({
  message = "Fetching your recommendations...",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
      <p className="text-lg font-medium text-gray-200">{message}</p>
      <p className="text-sm text-gray-400 mt-2 max-w-md">
        💡 Note: Our backend is hosted on a free cloud server and might take up
        to 30–50 seconds to wake up if it's been idle. Thanks for your patience!
      </p>
    </div>
  );
}
