export default function PrivateLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <>{children}</>
      // <div>
      //     <h1>Private</h1>
      //     {children}
      // </div>
    );
  }
  