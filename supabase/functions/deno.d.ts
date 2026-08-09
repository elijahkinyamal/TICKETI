// Ambient declaration of the Deno runtime globals used by Supabase Edge
// Functions. These functions run on Supabase's real Deno runtime (where `Deno`
// exists) — this file only stops the editor's TypeScript server from flagging
// `Deno` as undefined. It is NOT bundled or shipped; it has no runtime effect.
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}
