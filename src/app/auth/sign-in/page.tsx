import { AuthForm } from "@/components/auth/AuthForm";
import { signInAction } from "@/app/auth/actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center py-8">
      <AuthForm mode="sign-in" action={signInAction} error={error} />
    </div>
  );
}
