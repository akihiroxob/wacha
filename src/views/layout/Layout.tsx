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
      <body className="min-h-screen bg-white text-gray-700 antialiased">
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </body>
    </html>
  );
};
