export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>{children}</>
    // <div>
    //     <h1>Public</h1>
    //     {children}
    // </div>
  );
}
