export const Button = ({ text }: { text: string }) => {
  return (
    <button className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-stone-900 bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 hover:shadow-md focus:bg-stone-800">
      {text}
    </button>
  );
};
