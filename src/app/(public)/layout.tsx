// import { Metadata } from 'next';

// export const metadata: Metadata = {
//   title: 'Chatterly!',
//   icons: {
//     icon: '/Chatterly-Icon.png',
//   },
// };

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>{children}</>
  );
}