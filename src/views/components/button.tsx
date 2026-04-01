import { FC } from "hono/jsx";

export const Button: FC<{ text: string }> = ({ text }) => {
  return (
    <button class="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 font-medium text-white cursor-pointer hover:bg-gray-800 focus:bg-gray-600 ">
      {text}
    </button>
  );
};
