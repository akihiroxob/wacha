import { FC } from "hono/jsx";

export const Layout: FC<{ children: any }> = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="/css/style.css" />
        <title>Wacha</title>
      </head>
      <body className="font-sans text-gray-700">{children}</body>
    </html>
  );
};
