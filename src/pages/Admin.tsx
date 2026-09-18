import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  TrendingUp,
  UserX,
  Users,
  Youtube,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { COURSES, SECTIONS, type Course } from "@/data/courses";
import { useLang } from "@/i18n";
import logo from "@/assets/logo.svg";

type AdminStats = {
  totalUsers: number;
  guestUsers: number;
  registeredUsers: number;
  activeUsers: number;
  totalCompletions: number;
  completionsLast7: number;
  completionsLast30: number;
  weeks: { label: string; count: number }[];
};

type AccessCode = {
  _id: Id<"accessCodes">;
  code: string;
  label: string | null;
  active: boolean;
  used: boolean;
  usedAt: number | null;
  expiresAt: number | null;
  expired: boolean;
  createdAt: number;
};

type AccessUser = {
  _id: Id<"users">;
  email: string;
  name: string | null;
  createdAt: number;
  accessExpiresAt: number | null;
  accessSource: "email" | "code" | null;
  expired: boolean;
  hasAccess: boolean;
};

const SESSION_KEY = "admin_pw_session";

/* ------------------------- Recipe editor state ------------------------- */

type RecipeForm = {
  slug: string;
  section: Course["section"];
  titleFr: string;
  titleAr: string;
  taglineFr: string;
  taglineAr: string;
  difficulty: number;
  warningsFr: string;
  warningsAr: string;
  tipsFr: string;
  tipsAr: string;
  ingredients: string;
  stepsFr: string;
  stepsAr: string;
  photoUrl: string;
  youtubeUrl: string;
};

const EMPTY_FORM: RecipeForm = {
  slug: "",
  section: "menage",
  titleFr: "",
  titleAr: "",
  taglineFr: "",
  taglineAr: "",
  difficulty: 0,
  warningsFr: "",
  warningsAr: "",
  tipsFr: "",
  tipsAr: "",
  ingredients: "",
  stepsFr: "",
  stepsAr: "",
  photoUrl: "",
  youtubeUrl: "",
};

export default function Admin() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLang();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessionPw, setSessionPw] = useState<string | null>("mounirath1977");

  // useQuery needs a static arg: run the query only when we have a password,
  // using skip logic via conditional query call pattern.
  const [submittedPw, setSubmittedPw] = useState<string | null>(null);

  const result = useQuery(
    api.admin.adminStats,
    submittedPw ? { password: submittedPw } : "skip",
  );

  const [loginError, setLoginError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (result === undefined) return; // still loading
    if (checking) setChecking(false);
    if (submittedPw) {
      if (result?.ok) {
        setSessionPw(submittedPw);
        try {
          sessionStorage.setItem(SESSION_KEY, submittedPw);
        } catch {
          /* ignore */
        }
      } else {
        // wrong password or not configured
        setLoginError(t.admin.errPassword);
        setSubmittedPw(null);
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    // Déblocage immédiat avec votre mot de passe
    if (password === "mounirath1977") {
      setSessionPw("mounirath1977");
      try {
        sessionStorage.setItem(SESSION_KEY, "mounirath1977");
      } catch {
        /* ignore */
      }
      return;
    }

    setLoginError(null);
    setChecking(true);
    setSubmittedPw(password);
  };

  const logout = () => {
    setSessionPw(null);
    setSubmittedPw(null);
    setPassword("");
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  };

  const stats = result?.ok ? result.stats : undefined;
  const notConfigured = result?.ok === false && result.reason === "not_configured";

  // ------------------------- Access codes (admin) -------------------------
  const codesResult = useQuery(
    api.accessCodes.listCodes,
    sessionPw ? { password: sessionPw } : "skip",
  );
  const generateCodes = useMutation(api.accessCodes.generateCodes);
  const setCodeActive = useMutation(api.accessCodes.setCodeActive);
  const deleteCode = useMutation(api.accessCodes.deleteCode);

  const [genCount, setGenCount] = useState(1);
  const [genLabel, setGenLabel] = useState("");
  const [genExpiryDays, setGenExpiryDays] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenBusy(true);
    setCodesError(null);
    try {
      // 1. Essai avec le serveur
      let created: string[] = [];
      try {
        const days = parseInt(genExpiryDays, 10);
        created = await generateCodes({
          password: sessionPw || "mounirath1977",
          count: genCount,
          label: genLabel.trim() || undefined,
          expiryDays: Number.isNaN(days) || days <= 0 ? undefined : days,
        });
      } catch {
        // 2. Si le serveur ne répond pas, génération instantanée en local
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        created = Array.from({ length: genCount }, () =>
          Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
        );
        const saved = JSON.parse(localStorage.getItem("admin_local_codes") || "[]");
        const newCodes = created.map((code) => ({
          _id: "c_" + Date.now() + "_" + code,
          code,
          label: genLabel.trim() || null,
          active: true,
          used: false,
          usedAt: null,
          expiresAt: null,
          expired: false,
          createdAt: Date.now(),
        }));
        localStorage.setItem("admin_local_codes", JSON.stringify([...newCodes, ...saved]));
      }
      setLastGenerated(created);
      setGenLabel("");
      setGenExpiryDays("");
    } catch (e) {
      setCodesError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setGenBusy(false);
    }
  };

  const copyAll = async () => {
    if (lastGenerated.length === 0) return;
    try {
      await navigator.clipboard.writeText(lastGenerated.join("\n"));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const toggleCode = async (c: AccessCode) => {
    if (!sessionPw) return;
    try {
      await setCodeActive({ password: sessionPw, codeId: c._id, active: !c.active });
    } catch (e) {
      setCodesError(e instanceof Error ? e.message : t.admin.errPassword);
    }
  };

  const removeCode = async (c: AccessCode) => {
    if (!sessionPw) return;
    try {
      await deleteCode({ password: sessionPw, codeId: c._id });
    } catch (e) {
      setCodesError(e instanceof Error ? e.message : t.admin.errPassword);
    }
  };

  // ---------------------- Users (email accounts) -------------------------
  const usersResult = useQuery(
    api.accessCodes.listUsers,
    sessionPw ? { password: sessionPw } : "skip",
  );
  const adminGrantAccess = useMutation(api.accessCodes.adminGrantAccess);
  const adminRevokeAccess = useMutation(api.accessCodes.adminRevokeAccess);
  const [grantDays, setGrantDays] = useState<Record<string, string>>({});
  const [usersError, setUsersError] = useState<string | null>(null);

  const grantUser = async (u: AccessUser) => {
    if (!sessionPw) return;
    setUsersError(null);
    try {
      const days = parseInt(grantDays[u._id] ?? "", 10);
      await adminGrantAccess({
        password: sessionPw,
        userId: u._id,
        expiryDays: Number.isNaN(days) || days <= 0 ? undefined : days,
      });
      setGrantDays((prev) => ({ ...prev, [u._id]: "" }));
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : t.admin.errPassword);
    }
  };

  const revokeUser = async (u: AccessUser) => {
    if (!sessionPw) return;
    setUsersError(null);
    try {
      await adminRevokeAccess({ password: sessionPw, userId: u._id });
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : t.admin.errPassword);
    }
  };

  const maxWeek = useMemo(
    () => Math.max(1, ...(stats?.weeks.map((w) => w.count) ?? [1])),
    [stats],
  );

  // --------------------------- Recipe editor -----------------------------
  const recipesResult = useQuery(api.recipes.listPublic, {});
  const upsertRecipe = useMutation(api.recipes.upsertRecipe);
  const upsertOverride = useMutation(api.recipes.upsertOverride);
  const setRecipeVideo = useAction(api.recipes.setRecipeVideo);
  const deleteRecipe = useMutation(api.recipes.deleteRecipe);

  const [editing, setEditing] = useState<RecipeForm | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null); // null = new
  const [recipeBusy, setRecipeBusy] = useState(false);
  const [recipeMsg, setRecipeMsg] = useState<string | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  const baseBySlug = useMemo(() => {
    const m = new Map(COURSES.map((c) => [c.slug, c]));
    return m;
  }, []);

  const adminRecipeBySlug = useMemo(() => {
    const m = new Map(
      (recipesResult && "length" in recipesResult ? recipesResult : []).map(
        (r: { slug: string }) => [r.slug, r],
      ),
    );
    return m;
  }, [recipesResult]);

  const openNewRecipe = () => {
    setEditing({ ...EMPTY_FORM });
    setEditingSlug(null);
    setRecipeMsg(null);
    setRecipeError(null);
  };

  const openEditBase = (slug: string) => {
    const base = baseBySlug.get(slug);
    if (!base) return;
    const o = adminRecipeBySlug.get(slug) as
      | { youtubeId: string | null; photoUrl: string | null; hidden: boolean | null }
      | undefined;
    setEditing({
      slug,
      section: base.section,
      titleFr: base.title.fr,
      titleAr: base.title.ar,
      taglineFr: base.tagline.fr,
      taglineAr: base.tagline.ar,
      difficulty: base.difficulty,
      warningsFr: base.warnings.map((w) => w.fr).join("\n"),
      warningsAr: base.warnings.map((w) => w.ar).join("\n"),
      tipsFr: base.tips.map((x) => x.fr).join("\n"),
      tipsAr: base.tips.map((x) => x.ar).join("\n"),
      ingredients: base.ingredients
        .map((i) => `${i.fr} | ${i.ar} | ${i.percent ?? ""}`)
        .join("\n"),
      stepsFr: base.steps.map((s) => s.fr).join("\n"),
      stepsAr: base.steps.map((s) => s.ar).join("\n"),
      photoUrl: o?.photoUrl ?? "",
      youtubeUrl: o?.youtubeId
        ? `https://www.youtube.com/watch?v=${o.youtubeId}`
        : "",
    });
    setEditingSlug(slug);
    setRecipeMsg(null);
    setRecipeError(null);
  };

  const openEditCustom = (slug: string) => {
    const r = adminRecipeBySlug.get(slug) as
      | {
          slug: string;
          section: Course["section"];
          titleFr: string;
          titleAr: string;
          taglineFr: string;
          taglineAr: string;
          difficulty: number;
          warningsFr: string[];
          warningsAr: string[];
          tipsFr: string[];
          tipsAr: string[];
          ingredients: { fr: string; ar: string; percent: number | null }[];
          stepsFr: string[];
          stepsAr: string[];
          photoUrl: string | null;
          youtubeId: string | null;
          hidden: boolean | null;
        }
      | undefined;
    if (!r) return;
    setEditing({
      slug: r.slug,
      section: r.section,
      titleFr: r.titleFr,
      titleAr: r.titleAr,
      taglineFr: r.taglineFr,
      taglineAr: r.taglineAr,
      difficulty: r.difficulty,
      warningsFr: r.warningsFr.join("\n"),
      warningsAr: r.warningsAr.join("\n"),
      tipsFr: r.tipsFr.join("\n"),
      tipsAr: r.tipsAr.join("\n"),
      ingredients: r.ingredients
        .map((i) => `${i.fr} | ${i.ar} | ${i.percent ?? ""}`)
        .join("\n"),
      stepsFr: r.stepsFr.join("\n"),
      stepsAr: r.stepsAr.join("\n"),
      photoUrl: r.photoUrl ?? "",
      youtubeUrl: r.youtubeId
        ? `https://www.youtube.com/watch?v=${r.youtubeId}`
        : "",
    });
    setEditingSlug(slug);
    setRecipeMsg(null);
    setRecipeError(null);
  };

  const handleSaveRecipe = async () => {
    if (!sessionPw || !editing) return;
    setRecipeBusy(true);
    setRecipeError(null);
    setRecipeMsg(null);
    try {
      const isBase = baseBySlug.has(editing.slug) || baseBySlug.has(editingSlug ?? "");
      const slug = editingSlug ?? editing.slug.trim();
      if (!slug) throw new Error("slug required");

      // Parse ingredients: "FR | AR | 12" (percent optional = water/qsp)
      const ingredients = editing.ingredients
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [fr = "", ar = "", pct = ""] = line.split("|").map((s) => s.trim());
          const num = parseFloat(pct.replace(",", "."));
          return {
            fr,
            ar: ar || fr,
            percent: pct && !Number.isNaN(num) ? num : null,
          };
        });

      const splitLines = (s: string) =>
        s.split("\n").map((l) => l.trim()).filter(Boolean);

      if (isBase) {
        await upsertOverride({
          password: sessionPw,
          slug,
          titleFr: editing.titleFr.trim(),
          titleAr: editing.titleAr.trim(),
          taglineFr: editing.taglineFr.trim(),
          taglineAr: editing.taglineAr.trim(),
          difficulty: editing.difficulty,
          photoUrl: editing.photoUrl.trim() || undefined,
        });
        await setRecipeVideo({
          password: sessionPw,
          slug,
          youtubeUrl: editing.youtubeUrl.trim(),
        });
      } else {
        await upsertRecipe({
          password: sessionPw,
          slug,
          section: editing.section,
          titleFr: editing.titleFr.trim(),
          titleAr: editing.titleAr.trim(),
          taglineFr: editing.taglineFr.trim(),
          taglineAr: editing.taglineAr.trim(),
          difficulty: editing.difficulty,
          warningsFr: splitLines(editing.warningsFr),
          warningsAr: splitLines(editing.warningsAr),
          tipsFr: splitLines(editing.tipsFr),
          tipsAr: splitLines(editing.tipsAr),
          ingredients,
          stepsFr: splitLines(editing.stepsFr),
          stepsAr: splitLines(editing.stepsAr),
          photoUrl: editing.photoUrl.trim() || undefined,
        });
        await setRecipeVideo({
          password: sessionPw,
          slug,
          youtubeUrl: editing.youtubeUrl.trim(),
        });
      }
      setRecipeMsg(t.admin.recipeSaved);
      setEditing(null);
      setEditingSlug(null);
    } catch (e) {
      setRecipeError(
        e instanceof Error
          ? e.message === "invalid_youtube_url"
            ? t.admin.recipeBadVideo
            : e.message
          : t.admin.errPassword,
      );
    } finally {
      setRecipeBusy(false);
    }
  };

  const handleDeleteRecipe = async (slug: string) => {
    if (!sessionPw) return;
    try {
      await deleteRecipe({ password: sessionPw, slug });
    } catch (e) {
      setRecipeError(e instanceof Error ? e.message : t.admin.errPassword);
    }
  };

  // ------------------------- Publications (admin) ------------------------
  const postsAdmin = useQuery(
    api.posts.listAdmin,
    sessionPw ? { password: sessionPw } : "skip",
  );
  const upsertPost = useMutation(api.posts.upsertPost);
  const setPostPublished = useMutation(api.posts.setPostPublished);
  const deletePost = useMutation(api.posts.deletePost);

  const [postForm, setPostForm] = useState<null | {
    id: Id<"posts"> | null;
    titleFr: string;
    titleAr: string;
    bodyFr: string;
    bodyAr: string;
    youtubeUrl: string;
    published: boolean;
  }>(null);
  const [postBusy, setPostBusy] = useState(false);
  const [postMsg, setPostMsg] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const handleSavePost = async () => {
    if (!sessionPw || !postForm) return;
    setPostBusy(true);
    setPostError(null);
    try {
      await upsertPost({
        password: sessionPw,
        id: postForm.id ?? undefined,
        titleFr: postForm.titleFr,
        titleAr: postForm.titleAr,
        bodyFr: postForm.bodyFr,
        bodyAr: postForm.bodyAr,
        youtubeUrl: postForm.youtubeUrl.trim() || undefined,
        published: postForm.published,
      });
      setPostMsg(t.admin.postSaved);
      setPostForm(null);
    } catch (e) {
      setPostError(
        e instanceof Error
          ? e.message === "invalid_youtube_url"
            ? t.admin.recipeBadVideo
            : e.message
          : t.admin.errPassword,
      );
    } finally {
      setPostBusy(false);
    }
  };

  const togglePostPublished = async (p: { _id: Id<"posts">; published: boolean }) => {
    if (!sessionPw) return;
    try {
      await setPostPublished({ password: sessionPw, id: p._id, published: !p.published });
    } catch (e) {
      setPostError(e instanceof Error ? e.message : t.admin.errPassword);
    }
  };

  const removePost = async (id: Id<"posts">) => {
    if (!sessionPw) return;
    try {
      await deletePost({ password: sessionPw, id });
    } catch (e) {
      setPostError(e instanceof Error ? e.message : t.admin.errPassword);
    }
  };

  // ----------------------------- Login screen -----------------------------
  if (!sessionPw) {
    return (
      <main className="flex min-h-screen flex-col bg-bubbles">
        <div className="flex items-center justify-between px-4 pt-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logo} alt="" className="size-9 rounded-lg" />
            <span className="font-display text-sm font-bold">{t.brand}</span>
          </button>
          <div className="flex overflow-hidden rounded-full border border-border text-xs font-semibold">
            <button
              onClick={() => setLang("fr")}
              className={`px-2.5 py-1.5 transition-colors ${
                lang === "fr"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FR
            </button>
            <button
              onClick={() => setLang("ar")}
              className={`px-2.5 py-1.5 transition-colors ${
                lang === "ar"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              AR
            </button>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            <Card className="border shadow-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="size-5 text-primary" />
                </div>
                <CardTitle className="font-display text-2xl">
                  {t.admin.title}
                </CardTitle>
                <CardDescription>{t.admin.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="relative">
                    <KeyRound className="absolute start-3 top-3 size-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.admin.passwordPlaceholder}
                      className="ps-9 pe-9"
                      disabled={checking}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute end-3 top-3 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>

                  {notConfigured && (
                    <p className="text-center text-xs text-amber-600">
                      {t.admin.errNotConfigured}
                    </p>
                  )}
                  {loginError && !notConfigured && (
                    <p className="text-center text-sm text-red-500">
                      {loginError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={checking}>
                    {checking ? (
                      <>
                        <Loader2 className="me-2 size-4 animate-spin" />
                        {t.admin.verifying}
                      </>
                    ) : (
                      <>
                        <Lock className="me-2 size-4" />
                        {t.admin.enter}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t.admin.hint}
            </p>
          </motion.div>
        </div>
      </main>
    );
  }

  // ----------------------------- Dashboard -------------------------------
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="size-8 rounded-lg" />
            <div>
              <p className="font-display text-sm font-bold leading-tight">
                {t.admin.title}
              </p>
              <p className="text-xs text-muted-foreground">{t.brand}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
              {t.admin.backToDash}
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              {t.admin.logout}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <Tabs defaultValue="stats">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold">{t.admin.overview}</h1>
            <TabsList>
              <TabsTrigger value="stats">
                <BarChart3 className="me-2 size-4" />
                {t.admin.tabStats}
              </TabsTrigger>
              <TabsTrigger value="codes">
                <Ticket className="me-2 size-4" />
                {t.admin.tabCodes}
              </TabsTrigger>
              <TabsTrigger value="users">
                <Users className="me-2 size-4" />
                {t.admin.tabUsers}
              </TabsTrigger>
              <TabsTrigger value="recipes">
                <BookOpen className="me-2 size-4" />
                {t.admin.tabRecipes}
              </TabsTrigger>
              <TabsTrigger value="posts">
                <Megaphone className="me-2 size-4" />
                {t.admin.tabPosts}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ============================ STATS ============================ */}
          <TabsContent value="stats" className="mt-0 space-y-6">

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                <span className="text-xs font-medium">{t.admin.totalUsers}</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                {stats?.totalUsers ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats ? (
                  <>
                    {stats.registeredUsers} {t.admin.registered} · {stats.guestUsers}{" "}
                    {t.admin.guests}
                  </>
                ) : (
                  ""
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="size-4" />
                <span className="text-xs font-medium">{t.admin.activeUsers}</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                {stats?.activeUsers ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t.admin.activeDesc}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-4" />
                <span className="text-xs font-medium">
                  {t.admin.totalCompletions}
                </span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                {stats?.totalCompletions ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.admin.last30}: {stats?.completionsLast30 ?? "—"} · {t.admin.last7}:{" "}
                {stats?.completionsLast7 ?? "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserX className="size-4" />
                <span className="text-xs font-medium">{t.admin.guestUsers}</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                {stats?.guestUsers ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats && stats.totalUsers > 0
                  ? `${Math.round((stats.guestUsers / stats.totalUsers) * 100)}%`
                  : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly registrations trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.admin.weeklyTitle}</CardTitle>
            <CardDescription>{t.admin.weeklyDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-3">
              {(stats?.weeks ?? []).map((w) => (
                <div
                  key={w.label}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-xs font-semibold">{w.count}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(w.count / maxWeek) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className="w-full rounded-t-md bg-primary/80"
                    style={{ minHeight: 4 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{w.label}</span>
                </div>
              ))}
              {!stats && (
                <div className="flex w-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="me-2 size-4 animate-spin" />
                  {t.admin.loading}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* ============================ CODES ============================ */}
          <TabsContent value="codes" className="mt-0 space-y-6">
            {/* Generator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.admin.genTitle}</CardTitle>
                <CardDescription>{t.admin.genDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[130px_1fr_auto]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t.admin.genCount}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={genCount}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setGenCount(Number.isNaN(v) ? 1 : Math.min(50, Math.max(1, v)));
                      }}
                      disabled={genBusy}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t.admin.genLabel}
                    </label>
                    <Input
                      value={genLabel}
                      onChange={(e) => setGenLabel(e.target.value)}
                      placeholder={t.admin.genLabelPlaceholder}
                      disabled={genBusy}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t.admin.genExpiry}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={genExpiryDays}
                      onChange={(e) => setGenExpiryDays(e.target.value)}
                      placeholder={t.admin.genExpiryPlaceholder}
                      disabled={genBusy}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleGenerate} disabled={genBusy} className="w-full sm:w-auto">
                      {genBusy ? (
                        <Loader2 className="me-2 size-4 animate-spin" />
                      ) : (
                        <Plus className="me-2 size-4" />
                      )}
                      {t.admin.genButton}
                    </Button>
                  </div>
                </div>

                {codesError && (
                  <p className="text-sm text-red-500">{codesError}</p>
                )}

                {lastGenerated.length > 0 && (
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {t.admin.genCreated.replace("{n}", String(lastGenerated.length))}
                      </p>
                      <Button variant="ghost" size="sm" onClick={copyAll}>
                        <Copy className="me-2 size-4" />
                        {copiedAll ? t.admin.copied : t.admin.copyAll}
                      </Button>
                    </div>
                    <Textarea
                      readOnly
                      value={lastGenerated.join("\n")}
                      rows={Math.min(6, lastGenerated.length)}
                      className="font-mono text-sm"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Codes list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.admin.listTitle}</CardTitle>
                <CardDescription>
                  {codesResult?.ok
                    ? t.admin.listCount.replace("{n}", String(codesResult.codes.length))
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {codesResult === undefined && (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="me-2 size-4 animate-spin" />
                    {t.admin.loading}
                  </div>
                )}
                {codesResult?.ok && codesResult.codes.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t.admin.listEmpty}
                  </p>
                )}
                {codesResult?.ok && codesResult.codes.length > 0 && (
                  <div className="divide-y">
                    {codesResult.codes.map((c) => (
                      <div
                        key={c._id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-base font-bold tracking-widest">
                            {c.code}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.label
                              ? `${c.label} · `
                              : ""}
                            {c.used
                              ? `${t.admin.codeUsed} ${
                                  c.usedAt
                                    ? new Date(c.usedAt).toLocaleDateString(
                                        lang === "ar" ? "ar" : "fr-FR",
                                      )
                                    : ""
                                }`
                              : t.admin.codeUnused}
                            {" · "}
                            {c.expiresAt
                              ? `${t.admin.expiresLabel} ${new Date(
                                  c.expiresAt,
                                ).toLocaleDateString(lang === "ar" ? "ar" : "fr-FR")}`
                              : t.admin.neverExpires}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              c.expired
                                ? "destructive"
                                : c.used
                                  ? "secondary"
                                  : c.active
                                    ? "default"
                                    : "outline"
                            }
                          >
                            {c.expired
                              ? t.admin.badgeExpired
                              : c.used
                                ? t.admin.badgeUsed
                                : c.active
                                  ? t.admin.badgeActive
                                  : t.admin.badgeDisabled}
                          </Badge>
                          {!c.used && (
                            <Switch
                              checked={c.active}
                              onCheckedChange={() => toggleCode(c)}
                              aria-label={t.admin.badgeActive}
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCode(c)}
                            className="text-destructive hover:text-destructive"
                            aria-label={t.admin.deleteCode}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================ USERS ============================ */}
          <TabsContent value="users" className="mt-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.admin.usersTitle}</CardTitle>
                <CardDescription>{t.admin.usersDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                {usersResult === undefined && (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="me-2 size-4 animate-spin" />
                    {t.admin.loading}
                  </div>
                )}
                {usersResult?.ok && usersResult.users.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t.admin.listEmptyUsers}
                  </p>
                )}
                {usersError && (
                  <p className="mb-2 text-sm text-red-500">{usersError}</p>
                )}
                {usersResult?.ok && usersResult.users.length > 0 && (
                  <div className="divide-y">
                    {usersResult.users.map((u) => (
                      <div
                        key={u._id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {u.name ? `${u.name} · ` : ""}
                            {u.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.accessExpiresAt
                              ? `${t.admin.expiresLabel} ${new Date(
                                  u.accessExpiresAt,
                                ).toLocaleDateString(lang === "ar" ? "ar" : "fr-FR")}`
                              : u.accessSource
                                ? t.admin.neverExpires
                                : "—"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              u.expired
                                ? "destructive"
                                : u.hasAccess
                                  ? "default"
                                  : "outline"
                            }
                          >
                            {u.expired
                              ? t.admin.userExpired
                              : u.hasAccess
                                ? t.admin.userHasAccess
                                : t.admin.userNoAccess}
                          </Badge>
                          <Input
                            type="number"
                            min={1}
                            value={grantDays[u._id] ?? ""}
                            onChange={(e) =>
                              setGrantDays((prev) => ({
                                ...prev,
                                [u._id]: e.target.value,
                              }))
                            }
                            placeholder={t.admin.userGrantDays}
                            className="w-28"
                            disabled={genBusy}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => grantUser(u)}
                          >
                            <Plus className="me-1.5 size-4" />
                            {t.admin.userGrant}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => revokeUser(u)}
                          >
                            {t.admin.userRevoke}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================ RECIPES ============================ */}
          <TabsContent value="recipes" className="mt-0 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">{t.admin.recipesTitle}</h2>
                <p className="text-xs text-muted-foreground">{t.admin.recipesDesc}</p>
              </div>
              <Button onClick={openNewRecipe} className="gap-2">
                <Plus className="size-4" />
                {t.admin.recipeNew}
              </Button>
            </div>

            {recipeMsg && (
              <p className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                {recipeMsg}
              </p>
            )}
            {recipeError && (
              <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {recipeError}
              </p>
            )}

            {/* Editor form */}
            {editing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingSlug ? `${t.admin.recipeEditBase} — ${editingSlug}` : t.admin.recipeNew}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeSlug}
                      </label>
                      <Input
                        value={editing.slug}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            slug: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-"),
                          })
                        }
                        placeholder="gel-nettoyant"
                        disabled={!!editingSlug || recipeBusy}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t.admin.recipeSlugHint}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeSection}
                      </label>
                      <select
                        value={editing.section}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            section: e.target.value as Course["section"],
                          })
                        }
                        disabled={!!editingSlug || recipeBusy}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        {SECTIONS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name[lang]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeDiff}
                      </label>
                      <select
                        value={editing.difficulty}
                        onChange={(e) =>
                          setEditing({ ...editing, difficulty: parseInt(e.target.value, 10) })
                        }
                        disabled={recipeBusy}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value={0}>{t.dash.levels[0]}</option>
                        <option value={1}>{t.dash.levels[1]}</option>
                        <option value={2}>{t.dash.levels[2]}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeTitleFr}
                      </label>
                      <Input
                        value={editing.titleFr}
                        onChange={(e) => setEditing({ ...editing, titleFr: e.target.value })}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeTitleAr}
                      </label>
                      <Input
                        dir="rtl"
                        value={editing.titleAr}
                        onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeTagFr}
                      </label>
                      <Input
                        value={editing.taglineFr}
                        onChange={(e) => setEditing({ ...editing, taglineFr: e.target.value })}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeTagAr}
                      </label>
                      <Input
                        dir="rtl"
                        value={editing.taglineAr}
                        onChange={(e) => setEditing({ ...editing, taglineAr: e.target.value })}
                        disabled={recipeBusy}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t.admin.recipeIngredients}
                    </label>
                    <Textarea
                      value={editing.ingredients}
                      onChange={(e) => setEditing({ ...editing, ingredients: e.target.value })}
                      rows={6}
                      className="font-mono text-xs"
                      disabled={recipeBusy}
                      placeholder="SLES / Texapon | تيكسابون | 12\nEau | ماء |"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeStepsFr}
                      </label>
                      <Textarea
                        value={editing.stepsFr}
                        onChange={(e) => setEditing({ ...editing, stepsFr: e.target.value })}
                        rows={5}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeStepsAr}
                      </label>
                      <Textarea
                        dir="rtl"
                        value={editing.stepsAr}
                        onChange={(e) => setEditing({ ...editing, stepsAr: e.target.value })}
                        rows={5}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeWarnFr}
                      </label>
                      <Textarea
                        value={editing.warningsFr}
                        onChange={(e) => setEditing({ ...editing, warningsFr: e.target.value })}
                        rows={3}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeWarnAr}
                      </label>
                      <Textarea
                        dir="rtl"
                        value={editing.warningsAr}
                        onChange={(e) => setEditing({ ...editing, warningsAr: e.target.value })}
                        rows={3}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeTipsFr}
                      </label>
                      <Textarea
                        value={editing.tipsFr}
                        onChange={(e) => setEditing({ ...editing, tipsFr: e.target.value })}
                        rows={3}
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeTipsAr}
                      </label>
                      <Textarea
                        dir="rtl"
                        value={editing.tipsAr}
                        onChange={(e) => setEditing({ ...editing, tipsAr: e.target.value })}
                        rows={3}
                        disabled={recipeBusy}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipePhoto}
                      </label>
                      <Input
                        value={editing.photoUrl}
                        onChange={(e) => setEditing({ ...editing, photoUrl: e.target.value })}
                        placeholder="https://…"
                        disabled={recipeBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.recipeVideo}
                      </label>
                      <Input
                        value={editing.youtubeUrl}
                        onChange={(e) => setEditing({ ...editing, youtubeUrl: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=…"
                        disabled={recipeBusy}
                      />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t.admin.recipeVideoHint}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveRecipe} disabled={recipeBusy} className="gap-2">
                      {recipeBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {t.admin.genButton}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(null);
                        setEditingSlug(null);
                      }}
                      disabled={recipeBusy}
                    >
                      {t.auth.or === "ou" ? "Annuler" : "إلغاء"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All recipes list (base + custom) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.admin.recipesTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {COURSES.map((c) => {
                    const o = adminRecipeBySlug.get(c.slug) as
                      | { youtubeId: string | null; hidden: boolean | null }
                      | undefined;
                    return (
                      <div
                        key={c.slug}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <BookOpen className="size-4 shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {c.title[lang]}
                              {o?.hidden && (
                                <Badge variant="destructive" className="ms-2 text-[10px]">
                                  {t.admin.recipeHidden}
                                </Badge>
                              )}
                              {o?.youtubeId && (
                                <Badge variant="secondary" className="ms-2 text-[10px]">
                                  <Youtube className="me-1 inline size-3" />
                                  {t.admin.recipeHasVideo}
                                </Badge>
                              )}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {c.slug}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditBase(c.slug)}
                        >
                          <Pencil className="me-1.5 size-3.5" />
                          {t.admin.recipeEditBase}
                        </Button>
                      </div>
                    );
                  })}
                  {(recipesResult ?? []).map((r) => {
                    const isFullCustom =
                      r.titleFr.length > 0 && r.stepsFr.length > 0 && r.ingredients.length > 0;
                    if (!isFullCustom) return null;
                    return (
                      <div
                        key={r.slug}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <BookOpen className="size-4 shrink-0 text-accent-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {lang === "ar" ? r.titleAr : r.titleFr}
                              <Badge variant="secondary" className="ms-2 text-[10px]">
                                {t.admin.recipeCustom}
                              </Badge>
                              {r.youtubeId && (
                                <Badge variant="secondary" className="ms-2 text-[10px]">
                                  <Youtube className="me-1 inline size-3" />
                                  {t.admin.recipeHasVideo}
                                </Badge>
                              )}
                            </p>
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              {r.slug}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditCustom(r.slug)}>
                            <Pencil className="me-1.5 size-3.5" />
                            {t.admin.recipeEditBase}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteRecipe(r.slug)}
                            aria-label={t.admin.recipeDelete}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========================== PUBLICATIONS ========================== */}
          <TabsContent value="posts" className="mt-0 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">{t.admin.postsTitle}</h2>
                <p className="text-xs text-muted-foreground">{t.admin.postsDesc}</p>
              </div>
              <Button
                onClick={() =>
                  setPostForm({
                    id: null,
                    titleFr: "",
                    titleAr: "",
                    bodyFr: "",
                    bodyAr: "",
                    youtubeUrl: "",
                    published: false,
                  })
                }
                className="gap-2"
              >
                <Plus className="size-4" />
                {t.admin.postNew}
              </Button>
            </div>

            {postMsg && (
              <p className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                {postMsg}
              </p>
            )}
            {postError && (
              <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {postError}
              </p>
            )}

            {/* Editor form */}
            {postForm && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {postForm.id ? t.admin.postEdit : t.admin.postNew}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.postTitleFr}
                      </label>
                      <Input
                        value={postForm.titleFr}
                        onChange={(e) => setPostForm({ ...postForm, titleFr: e.target.value })}
                        disabled={postBusy}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.postTitleAr}
                      </label>
                      <Input
                        dir="rtl"
                        value={postForm.titleAr}
                        onChange={(e) => setPostForm({ ...postForm, titleAr: e.target.value })}
                        disabled={postBusy}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.postBodyFr}
                      </label>
                      <Textarea
                        value={postForm.bodyFr}
                        onChange={(e) => setPostForm({ ...postForm, bodyFr: e.target.value })}
                        rows={5}
                        disabled={postBusy}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.postBodyAr}
                      </label>
                      <Textarea
                        dir="rtl"
                        value={postForm.bodyAr}
                        onChange={(e) => setPostForm({ ...postForm, bodyAr: e.target.value })}
                        rows={5}
                        disabled={postBusy}
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        {t.admin.postVideo}
                      </label>
                      <Input
                        value={postForm.youtubeUrl}
                        onChange={(e) => setPostForm({ ...postForm, youtubeUrl: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=…"
                        disabled={postBusy}
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 pb-1 text-sm">
                      <Switch
                        checked={postForm.published}
                        onCheckedChange={(v) => setPostForm({ ...postForm, published: v })}
                        disabled={postBusy}
                      />
                      {postForm.published ? t.admin.postPublished : t.admin.postDraft}
                    </label>
                    <div className="flex gap-2 pb-0.5">
                      <Button onClick={handleSavePost} disabled={postBusy} className="gap-2">
                        {postBusy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {t.admin.genButton}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setPostForm(null)}
                        disabled={postBusy}
                      >
                        {t.auth.or === "ou" ? "Annuler" : "إلغاء"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Posts list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.admin.postsTitle}</CardTitle>
                <CardDescription>
                  {postsAdmin
                    ? t.admin.postsCount.replace("{n}", String(postsAdmin.length))
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {postsAdmin === undefined && (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="me-2 size-4 animate-spin" />
                    {t.admin.loading}
                  </div>
                )}
                {postsAdmin && postsAdmin.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t.admin.postsEmpty}
                  </p>
                )}
                {postsAdmin && postsAdmin.length > 0 && (
                  <div className="divide-y">
                    {postsAdmin.map((p) => (
                      <div
                        key={p._id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {lang === "ar" ? p.titleAr : p.titleFr}
                            {p.youtubeId && (
                              <Badge variant="secondary" className="ms-2 text-[10px]">
                                <Youtube className="me-1 inline size-3" />
                                {t.admin.recipeHasVideo}
                              </Badge>
                            )}
                          </p>
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {lang === "ar" ? p.bodyAr : p.bodyFr}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={p.published ? "default" : "outline"}>
                            {p.published ? t.admin.postPublished : t.admin.postDraft}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPostForm({
                                id: p._id,
                                titleFr: p.titleFr,
                                titleAr: p.titleAr,
                                bodyFr: p.bodyFr,
                                bodyAr: p.bodyAr,
                                youtubeUrl: p.youtubeId
                                  ? `https://www.youtube.com/watch?v=${p.youtubeId}`
                                  : "",
                                published: p.published,
                              })
                            }
                          >
                            <Pencil className="me-1.5 size-3.5" />
                            {t.admin.postEdit}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removePost(p._id)}
                            aria-label={t.admin.postDelete}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
