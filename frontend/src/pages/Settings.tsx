import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { AnimatedModal } from '../components/ui/AnimatedModal';
import { Skeleton } from '../components/ui/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../store/auth';
import { pushToast, toast } from '../lib/toast';
import { 
  Settings, User, Store, Bell, Database, FileText, 
  Save, Check, Moon, Sun, Palette, Scale, Shield,
  Globe, Wallet, Building2, MapPin, Receipt, Key, RefreshCw, Plus
} from 'lucide-react';

type TabId = 'general' | 'store' | 'legal' | 'invoice' | 'profile' | 'roles' | 'notifications' | 'backup' | 'appearance' | 'license' | 'update';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Settings;
  category: 'main' | 'account' | 'system';
}

const tabs: Tab[] = [
  { id: 'general', label: 'Général', icon: Settings, category: 'main' },
  { id: 'store', label: 'Boutique', icon: Store, category: 'main' },
  { id: 'legal', label: 'Juridique & Fiscal', icon: Scale, category: 'main' },
  { id: 'invoice', label: 'Facturation', icon: Receipt, category: 'main' },
  { id: 'profile', label: 'Mon Profil', icon: User, category: 'account' },
  { id: 'roles', label: 'Rôles & Permissions', icon: Shield, category: 'account' },
  { id: 'notifications', label: 'Notifications', icon: Bell, category: 'system' },
  { id: 'backup', label: 'Sauvegarde', icon: Database, category: 'system' },
  { id: 'appearance', label: 'Apparence', icon: Palette, category: 'system' },
  { id: 'license', label: 'Licence', icon: Key, category: 'system' },
  { id: 'update', label: 'Mises à jour', icon: RefreshCw, category: 'system' },
];

function GeneralTab() {
  const me = useAuth((s) => s.user);
  const canMutate = me?.role === 'admin';
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'store'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/settings/store');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/api/settings/store', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'store'] });
      pushToast({ kind: 'success', title: 'Paramètres sauvegardés' });
    },
    onError: (e: any) => {
      pushToast({ kind: 'error', title: 'Erreur de sauvegarde', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur inconnue') });
    }
  });

  const [form, setForm] = useState<any>({});
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (form.currency && form.currency.length > 3) newErrors.currency = 'Max 3 caractères';
    if (form.tax_rate && (form.tax_rate < 0 || form.tax_rate > 100)) newErrors.tax_rate = 'Entre 0 et 100';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const hasLanguageChange = Object.prototype.hasOwnProperty.call(form, 'language');
  const hasStoreChanges = Object.keys(form).some((k) => k !== 'language');
  const canSave = (canMutate && hasStoreChanges) || hasLanguageChange;

  const handleSave = async () => {
    if (!canSave) return;
    if (!validate()) return;

    const { language, ...storeForm } = form;

    try {
      if (hasLanguageChange && typeof language === 'string') {
        await api.patch('/api/users/me', { language });
      }

      if (hasStoreChanges) {
        if (!canMutate) return;
        await updateMutation.mutateAsync(storeForm);
      }

      setSaved(true);
      setForm({});
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur inconnue') });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Paramètres Généraux</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Configuration de base de l'application</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
            <Globe className="h-4 w-4 text-[color:var(--accent-strong)]" />
            Langue & Région
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[color:var(--fg-muted)] mb-1">Langue</label>
              <select
                className="w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-2.5 text-sm text-[color:var(--fg)] focus:outline-none transition focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]"
                value={form.language || settings?.language || 'fr'}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--fg-muted)] mb-1">Fuseau horaire</label>
              <select className="w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-2.5 text-sm text-[color:var(--fg)] focus:outline-none transition focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]">
                <option>Africa/Algiers (GMT+1)</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[color:var(--accent-strong)]" />
            Devise & Taxes
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Input
                label="Devise"
                value={form.currency || settings?.currency || ''}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                maxLength={3}
                placeholder="DZD"
              />
              {errors.currency && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.currency}</p>}
            </div>
            <Input
              label="Symbole"
              value={form.currency_symbol || settings?.currency_symbol || ''}
              onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
              placeholder="DA"
            />
            <div>
              <Input
                label="Taux TVA (%)"
                type="number"
                min={0}
                max={100}
                value={form.tax_rate ?? settings?.tax_rate ?? 0}
                onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
              />
              {errors.tax_rate && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.tax_rate}</p>}
            </div>
          </div>
          <Input
            label="Label taxe"
            value={form.tax_label || settings?.tax_label || ''}
            onChange={(e) => setForm({ ...form, tax_label: e.target.value })}
            placeholder="TVA"
          />
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!canSave || updateMutation.isPending} className="w-fit">
            {saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saved ? 'Enregistré!' : updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          {!canMutate && hasStoreChanges && (
            <div className="text-sm text-[color:var(--fg-muted)]">Accès réservé aux administrateurs.</div>
          )}
          {Object.keys(form).length > 0 && (
            <Button variant="ghost" onClick={() => setForm({})}>
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StoreTab() {
  const me = useAuth((s) => s.user);
  const canMutate = me?.role === 'admin';
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'store'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/settings/store');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/api/settings/store', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'store'] });
    }
  });

  const [form, setForm] = useState<any>({});
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email invalide';
    }
    if (form.phone && !/^[\d\s+-]+$/.test(form.phone)) {
      newErrors.phone = 'Téléphone invalide';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!canMutate) return;
    if (!validate()) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        setSaved(true);
        setForm({});
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Informations de la Boutique</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Détails de votre commerce</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[color:var(--accent-strong)]" />
            Identité
          </h3>
          <Input
            label="Nom de la boutique"
            value={form.store_name || settings?.store_name || ''}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
            placeholder="La Vie En Rose 34"
          />
          <Input
            label="Nom du propriétaire"
            value={form.owner_name || settings?.owner_name || ''}
            onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
          />
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[color:var(--accent-strong)]" />
            Coordonnées
          </h3>
          <Input
            label="Adresse"
            value={form.address || settings?.address || ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Ville"
              value={form.city || settings?.city || ''}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <Input
              label="Code postal"
              value={form.postal_code || settings?.postal_code || ''}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Téléphone"
                value={form.phone || settings?.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+213 555 123 456"
              />
              {errors.phone && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.phone}</p>}
            </div>
            <div>
              <Input
                label="Email"
                type="email"
                value={form.email || settings?.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contact@boutique.dz"
              />
              {errors.email && <p className="text-xs text-[color:var(--danger)] mt-1">{errors.email}</p>}
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={!canMutate || updateMutation.isPending} className="w-fit">
            {saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saved ? 'Enregistré!' : updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          {!canMutate && (
            <div className="text-sm text-[color:var(--fg-muted)]">Accès réservé aux administrateurs.</div>
          )}
          {Object.keys(form).length > 0 && (
            <Button variant="ghost" onClick={() => setForm({})}>
              Réinitialiser
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LegalTab() {
  const me = useAuth((s) => s.user);
  const canMutate = me?.role === 'admin';
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'store'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/settings/store');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/api/settings/store', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'store'] });
    }
  });

  const [form, setForm] = useState<any>({});
  const [saved, setSaved] = useState(false);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  const handleSave = () => {
    if (!canMutate) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        setSaved(true);
        setForm({});
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Informations Juridiques & Fiscales</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Identifiants pour les factures officielles</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
            <Scale className="h-4 w-4 text-[color:var(--color-secondary-600)]" />
            Identifiants Fiscaux Algériens
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="NIF (Numéro d'Identification Fiscale)"
              value={form.nif || settings?.nif || ''}
              onChange={(e) => setForm({ ...form, nif: e.target.value })}
              placeholder="000000000000000"
            />
            <Input
              label="NIS (Numéro d'Identification Statistique)"
              value={form.nis || settings?.nis || ''}
              onChange={(e) => setForm({ ...form, nis: e.target.value })}
              placeholder="0000000000"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="RC (Registre de Commerce)"
              value={form.rc || settings?.rc || ''}
              onChange={(e) => setForm({ ...form, rc: e.target.value })}
              placeholder="00/00-000000 A"
            />
            <Input
              label="ART (Carte Artisan)"
              value={form.art || settings?.art || ''}
              onChange={(e) => setForm({ ...form, art: e.target.value })}
            />
          </div>
          <Input
            label="Article TVA"
            value={form.article_tva || settings?.article_tva || ''}
            onChange={(e) => setForm({ ...form, article_tva: e.target.value })}
            placeholder="Ex: 19%"
          />
        </Card>

        <Button onClick={handleSave} disabled={!canMutate || updateMutation.isPending} className="w-fit">
          {saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saved ? 'Enregistré!' : updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
        {!canMutate && (
          <div className="text-sm text-[color:var(--fg-muted)]">Accès réservé aux administrateurs.</div>
        )}
      </div>
    </div>
  );
}

function InvoiceTab() {
  const me = useAuth((s) => s.user);
  const canMutate = me?.role === 'admin';
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'store'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/settings/store');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/api/settings/store', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'store'] });
    }
  });

  const [form, setForm] = useState<any>({});
  const [saved, setSaved] = useState(false);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  const handleSave = () => {
    if (!canMutate) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Paramètres de Facturation</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Configuration des factures et reçus</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Format de Facture
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Préfixe des factures"
              value={form.invoice_prefix || settings?.invoice_prefix || ''}
              onChange={(e) => setForm({ ...form, invoice_prefix: e.target.value })}
              placeholder="LVR"
            />
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="qr_enabled"
                checked={form.qr_code_enabled ?? settings?.qr_code_enabled ?? true}
                onChange={(e) => setForm({ ...form, qr_code_enabled: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="qr_enabled" className="text-sm text-[color:var(--fg-muted)]">
                Activer le code QR
              </label>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)]">Pied de facture</h3>
          <textarea
            className="w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3 min-h-[120px] text-sm text-[color:var(--fg)] focus:outline-none transition placeholder:text-[color:var(--fg-subtle)] focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]"
            value={form.invoice_footer || settings?.invoice_footer || ''}
            onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })}
            placeholder="Merci pour votre confiance..."
          />
        </Card>

        <Button onClick={handleSave} disabled={!canMutate || updateMutation.isPending} className="w-fit">
          {saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saved ? 'Enregistré!' : updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
        {!canMutate && (
          <div className="text-sm text-[color:var(--fg-muted)]">Accès réservé aux administrateurs.</div>
        )}
      </div>
    </div>
  );
}

function ProfileTab() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/users/me');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch('/api/users/me', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      pushToast({ kind: 'success', title: 'Profil enregistré' });
    },
    onError: (e: any) => {
      pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur') });
    }
  });

  const [form, setForm] = useState<any>({});
  const [saved, setSaved] = useState(false);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  const handleSave = () => {
    if (Object.keys(form).length === 0) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        setSaved(true);
        setForm({});
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Mon Profil</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Gérez vos informations personnelles</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--accent)_55%,var(--surface-1)),color-mix(in_srgb,var(--accent)_22%,transparent)_55%),linear-gradient(135deg,color-mix(in_srgb,var(--accent)_65%,transparent),color-mix(in_srgb,var(--color-secondary-500)_28%,transparent))] border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] flex items-center justify-center text-[color:var(--on-accent)] text-2xl font-bold shadow-glass">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-medium text-[color:var(--fg)]">{user?.full_name || user?.username}</h3>
            <p className="text-sm text-[color:var(--fg-subtle)] capitalize">{user?.role}</p>
          </div>
        </div>

        <Card className="p-4 space-y-4">
          <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
            <User className="h-4 w-4" />
            Informations personnelles
          </h3>
          <Input
            label="Nom complet"
            value={form.full_name || user?.full_name || ''}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={form.email || user?.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Téléphone"
              value={form.phone || user?.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </Card>

        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-fit">
          {saved ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saved ? 'Enregistré!' : updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </Button>

        <PasswordChangeSection />
      </div>
    </div>
  );
}

function PasswordChangeSection() {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [busy, setBusy] = useState(false);

  const handleChange = async () => {
    if (!oldPwd || newPwd.length < 8) {
      pushToast({ kind: 'error', title: 'Mot de passe invalide', message: 'Nouveau mot de passe: min 8 caractères.' });
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/users/me/password', { current_password: oldPwd, new_password: newPwd });
      pushToast({ kind: 'success', title: 'Mot de passe modifié' });
      setOldPwd('');
      setNewPwd('');
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Erreur';
      pushToast({ kind: 'error', title: 'Erreur', message: String(msg) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-4 max-w-2xl mt-6">
      <h3 className="font-medium text-[color:var(--fg)] flex items-center gap-2">
        <Key className="h-4 w-4 text-[color:var(--accent-strong)]" />
        Changer le mot de passe
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Mot de passe actuel"
          type="password"
          value={oldPwd}
          onChange={(e) => setOldPwd(e.target.value)}
          autoComplete="current-password"
        />
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          autoComplete="new-password"
          placeholder="Min. 8 caractères"
        />
      </div>
      <Button onClick={handleChange} disabled={busy || !oldPwd || newPwd.length < 8} variant="secondary" className="w-fit">
        {busy ? 'Modification...' : 'Modifier le mot de passe'}
      </Button>
    </Card>
  );
}

function RolesTab() {
  const me = useAuth((s) => s.user);
  const canManageUsers = Boolean(me?.permissions?.includes('manage_users'));
  const isAdminActor = me?.role === 'admin';

  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/roles');
      return res.data;
    },
    enabled: canManageUsers,
  });

  const permissionsCatalogQuery = useQuery({
    queryKey: ['permissions', 'catalog'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/roles/permissions');
      return res.data;
    },
    enabled: canManageUsers,
  });

  const roleItems: Array<{ id: string; name: string; permissions: string[]; createdAt?: any }> = useMemo(() => {
    const raw = (rolesQuery.data as any)?.items;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r: any) => ({
        id: String(r?.id ?? ''),
        name: String(r?.name ?? r?.id ?? ''),
        permissions: Array.isArray(r?.permissions) ? r.permissions.filter((p: any) => typeof p === 'string') : [],
        createdAt: r?.createdAt,
      }))
      .filter((r) => Boolean(r.id));
  }, [rolesQuery.data]);

  const roleMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; permissions: string[] }>();
    for (const r of roleItems) m.set(r.id, { id: r.id, name: r.name, permissions: r.permissions });
    return m;
  }, [roleItems]);

  const allPermissions: string[] = useMemo(() => {
    const raw = (permissionsCatalogQuery.data as any)?.items;
    if (!Array.isArray(raw)) return [];
    return raw.filter((p: any) => typeof p === 'string');
  }, [permissionsCatalogQuery.data]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'employee'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    roleId: 'employee' as 'admin' | 'manager' | 'employee',
    active: true,
  });

  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [roleEditorBusy, setRoleEditorBusy] = useState(false);
  const [roleEditorError, setRoleEditorError] = useState<string | null>(null);
  const [roleEditorIsNew, setRoleEditorIsNew] = useState(true);
  const [roleEditor, setRoleEditor] = useState<{ id: string; name: string; permissions: string[] }>({
    id: '',
    name: '',
    permissions: [],
  });

  const [selectedRoleId, setSelectedRoleId] = useState<string>(() => {
    try {
      const stored = window.localStorage.getItem('lver34.roles.selectedRoleId');
      return stored && stored !== 'undefined' && stored !== 'null' ? stored : '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      if (selectedRoleId) window.localStorage.setItem('lver34.roles.selectedRoleId', selectedRoleId);
    } catch {
      // ignore
    }
  }, [selectedRoleId]);

  useEffect(() => {
    if (roleItems.length === 0) return;
    if (selectedRoleId && roleMap.has(selectedRoleId)) return;
    setSelectedRoleId(roleItems[0]?.id || '');
  }, [roleItems, roleMap, selectedRoleId]);

  const usersQuery = useQuery({
    queryKey: ['users'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/users');
      return res.data;
    },
    enabled: canManageUsers,
  });

  const roleCreateMutation = useMutation({
    mutationFn: async (p: { id: string; name: string; permissions: string[] }) => {
      const res = await api.post('/api/roles', p);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e: any) => {
      const resp = e?.response?.data;
      toast('error', 'Création impossible', String(resp?.message ?? resp?.detail ?? resp?.error ?? e?.message ?? e));
    },
  });

  const roleUpdateMutation = useMutation({
    mutationFn: async (p: { id: string; name: string; permissions: string[] }) => {
      const res = await api.put(`/api/roles/${encodeURIComponent(p.id)}`, { name: p.name, permissions: p.permissions });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e: any) => {
      const resp = e?.response?.data;
      toast('error', 'Modification impossible', String(resp?.message ?? resp?.detail ?? resp?.error ?? e?.message ?? e));
    },
  });

  const roleDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/roles/${encodeURIComponent(id)}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (e: any) => {
      const resp = e?.response?.data;
      toast('error', 'Suppression impossible', String(resp?.message ?? resp?.detail ?? resp?.error ?? e?.message ?? e));
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Map form fields to backend schema
      // Local auth: { username, password, role, full_name, email }
      // Firebase: { displayName, email, password, roleId, active }
      const payload = {
        username: form.displayName,  // local auth field
        displayName: form.displayName,  // firebase field
        email: form.email || undefined,
        password: form.password,
        role: form.roleId,  // local auth field
        roleId: form.roleId,  // firebase field
        active: form.active,
        full_name: form.displayName,  // local profile
      };
      const res = await api.post('/api/users', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => {
      const resp = e?.response?.data;
      toast('error', 'Création impossible', String(resp?.message ?? resp?.detail ?? e?.message ?? e));
    },
  });

  const activeMutation = useMutation({
    mutationFn: async (p: { id: string; active: boolean }) => {
      const res = await api.patch(`/api/users/${p.id}/active`, { active: p.active });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => {
      const resp = e?.response?.data;
      toast('error', 'Action impossible', String(resp?.message ?? resp?.detail ?? e?.message ?? e));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => {
      const resp = e?.response?.data;
      toast('error', 'Suppression impossible', String(resp?.message ?? resp?.detail ?? e?.message ?? e));
    },
  });

  const roleMutation = useMutation({
    mutationFn: async (p: { id: string; roleId: 'admin' | 'manager' | 'employee' }) => {
      const res = await api.patch(`/api/users/${p.id}/role`, { roleId: p.roleId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e: any) => {
      const resp = e?.response?.data;
      toast('error', 'Modification impossible', String(resp?.message ?? resp?.detail ?? e?.message ?? e));
    },
  });

  if (!canManageUsers)
    return (
      <Card className="p-6">
        <div className="text-sm font-semibold text-[color:var(--fg)]">Accès restreint</div>
        <div className="mt-1 text-xs text-[color:var(--fg-muted)]">
          Vous n’avez pas la permission de gérer les utilisateurs.
        </div>
      </Card>
    );

  if (usersQuery.isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  if (usersQuery.isError)
    return (
      <Card className="p-6 border border-[color:color-mix(in_srgb,var(--danger)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)]">
        <div className="text-sm font-semibold text-[color:var(--danger)]">Impossible de charger les utilisateurs</div>
        <div className="mt-1 text-xs text-[color:var(--fg-muted)]">Vérifiez la connexion et réessayez.</div>
      </Card>
    );

  const roleColors: Record<string, string> = {
    admin:
      'bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[color:var(--accent-strong)] border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)]',
    manager:
      'bg-[color:color-mix(in_srgb,var(--color-secondary-500)_10%,transparent)] text-[color:var(--color-secondary-700)] border border-[color:color-mix(in_srgb,var(--color-secondary-500)_22%,transparent)]',
    employee: 'bg-[color:var(--glass-bg)] text-[color:var(--fg-muted)] border border-[color:var(--border-soft)]'
  };

  const items: any[] = Array.isArray((usersQuery.data as any)?.items) ? (usersQuery.data as any).items : [];
  const filtered = useMemo(() => {
    return items
      .filter((u) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const hay = `${u.displayName ?? ''} ${u.full_name ?? ''} ${u.username ?? ''} ${u.email ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .filter((u) => {
        if (roleFilter === 'all') return true;
        const role = String(u.roleId ?? u.role ?? 'employee');
        return role === roleFilter;
      })
      .filter((u) => {
        if (statusFilter === 'all') return true;
        const active = u.active === undefined ? true : Boolean(u.active);
        return statusFilter === 'active' ? active : !active;
      });
  }, [items, roleFilter, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Rôles & Permissions</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Gestion des utilisateurs et leurs droits</p>
      </div>

      <div className="grid gap-6">
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Recherche (nom / email / rôle)"
                className="md:w-[360px]"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="h-11 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 text-sm text-[color:var(--fg)] focus:outline-none transition focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]"
              >
                <option value="all">Tous les rôles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-11 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 text-sm text-[color:var(--fg)] focus:outline-none transition focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
              </select>
            </div>

            <Button
              variant="luxe"
              className="h-11 whitespace-nowrap px-5"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouvel utilisateur
            </Button>
          </div>
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-medium text-[color:var(--fg)]">Rôles</h3>
              {rolesQuery.isLoading && <span className="text-xs text-[color:var(--fg-muted)]">Chargement...</span>}
              {rolesQuery.isError && <span className="text-xs text-[color:var(--danger)]">Erreur de chargement</span>}
            </div>

            {isAdminActor && (
              <Button
                variant="luxe"
                className="h-10 whitespace-nowrap px-4"
                onClick={() => {
                  setRoleEditorError(null);
                  setRoleEditorIsNew(true);
                  setRoleEditor({ id: '', name: '', permissions: [] });
                  setRoleEditorOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nouveau rôle
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {roleItems.map((r) => {
              const isSelected = r.id === selectedRoleId;
              const canDelete = isAdminActor && r.id !== 'admin' && r.id !== 'manager' && r.id !== 'employee';
              return (
                <button
                  key={r.id}
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedRoleId(r.id)}
                >
                  <Card
                    className={
                      `p-4 cursor-pointer transition border ` +
                      (isSelected
                        ? 'border-[color:color-mix(in_srgb,var(--accent)_55%,transparent)]'
                        : 'border-[color:var(--border-soft)]')
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium text-[color:var(--fg)] truncate">{r.name || r.id}</span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded border border-[color:var(--border-soft)] text-[color:var(--fg-muted)]">
                        {r.id}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {(r.permissions || []).slice(0, 10).map((p) => (
                        <span
                          key={p}
                          className="text-xs px-2 py-1 rounded border border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--surface-1)_70%,transparent)] text-[color:var(--fg-muted)]"
                        >
                          {p}
                        </span>
                      ))}
                      {Array.isArray(r.permissions) && r.permissions.length > 10 && (
                        <span className="text-xs px-2 py-1 rounded border border-[color:var(--border-soft)] text-[color:var(--fg-muted)]">
                          +{r.permissions.length - 10}
                        </span>
                      )}
                    </div>

                    {isAdminActor && (
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="h-9"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setRoleEditorError(null);
                            setRoleEditorIsNew(false);
                            setRoleEditor({ id: r.id, name: r.name || r.id, permissions: Array.isArray(r.permissions) ? r.permissions : [] });
                            setRoleEditorOpen(true);
                          }}
                        >
                          Modifier
                        </Button>

                        <Button
                          variant="outline"
                          className="h-9"
                          disabled={!canDelete || roleDeleteMutation.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!canDelete) return;
                            pushToast({
                              kind: 'info',
                              title: 'Confirmation requise',
                              message: `Supprimer le rôle ${r.name || r.id} ?`,
                              actionLabel: 'Confirmer',
                              onAction: () => {
                                roleDeleteMutation.mutate(r.id, {
                                  onSuccess: () => toast('success', 'Rôle supprimé'),
                                });
                              },
                              ttlMs: 6000,
                            });
                          }}
                        >
                          Supprimer
                        </Button>
                      </div>
                    )}
                  </Card>
                </button>
              );
            })}
          </div>
        </Card>

        <div>
          <h3 className="font-medium text-[color:var(--fg)] mb-3">Utilisateurs ({filtered.length})</h3>
          <div className="space-y-2">
            {filtered.length === 0 && (
              <Card className="p-6 text-center">
                <div className="text-sm font-semibold text-[color:var(--fg)]">Aucun utilisateur</div>
                <div className="mt-1 text-xs text-[color:var(--fg-muted)]">Ajustez les filtres ou créez un nouvel utilisateur.</div>
              </Card>
            )}
            {filtered.map((u: any) => {
              const role = String(u.roleId ?? u.role ?? 'employee');
              const normalizedRole = roleMap.has(role) ? role : 'employee';
              const active = u.active === undefined ? true : Boolean(u.active);
              const isAdminTarget = normalizedRole === 'admin';
              const isSelf = String(u.id) === String(me?.id || '');
              const display = u.displayName || u.full_name || u.username || u.email || u.id;
              const initial = String(display).trim().charAt(0).toUpperCase();
              const lastLogin = u.lastLoginAt?.seconds
                ? new Date(u.lastLoginAt.seconds * 1000).toLocaleString('fr-FR')
                : u.last_login
                  ? new Date(Number(u.last_login)).toLocaleString('fr-FR')
                  : '—';

              return (
                <div
                  key={u.id}
                  className="lux-row flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--accent)_55%,var(--surface-1)),color-mix(in_srgb,var(--accent)_22%,transparent)_55%),linear-gradient(135deg,color-mix(in_srgb,var(--accent)_65%,transparent),color-mix(in_srgb,var(--color-secondary-500)_28%,transparent))] border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] flex items-center justify-center text-[color:var(--on-accent)] text-sm font-bold shadow-glass">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[color:var(--fg)]">{u.username}</div>
                      <div className="text-sm text-[color:var(--fg-muted)] truncate">{u.email}</div>
                      <div className="mt-1 text-[11px] text-[color:var(--fg-muted)]">Dernière connexion: {lastLogin}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[normalizedRole] || roleColors.employee}`}
                    >
                      {normalizedRole}
                    </span>

                    <select
                      value={normalizedRole}
                      disabled={roleMutation.isPending || isSelf || (!isAdminActor && isAdminTarget)}
                      onChange={(e) => {
                        const next = String(e.target.value || 'employee');
                        if (!roleMap.has(next) && next !== 'admin' && next !== 'manager' && next !== 'employee') return;
                        if (!isAdminActor && next === 'admin') return;
                        roleMutation.mutate({ id: String(u.id), roleId: next as any });
                      }}
                      className="h-9 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-3 text-xs text-[color:var(--fg)] focus:outline-none transition focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]"
                    >
                      {roleItems.map((r) => {
                        if (!isAdminActor && r.id === 'admin') return null;
                        return (
                          <option key={r.id} value={r.id}>
                            {r.id}
                          </option>
                        );
                      })}
                    </select>

                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                        active
                          ? 'border-[color:color-mix(in_srgb,var(--success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] text-[color:var(--success)]'
                          : 'border-[color:color-mix(in_srgb,var(--danger)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] text-[color:var(--danger)]'
                      }`}
                    >
                      {active ? 'Actif' : 'Inactif'}
                    </span>

                    <Button
                      variant="secondary"
                      disabled={activeMutation.isPending || isSelf || (!isAdminActor && isAdminTarget)}
                      onClick={() => {
                        if (isSelf) return;
                        activeMutation.mutate({ id: String(u.id), active: !active });
                      }}
                    >
                      {active ? 'Désactiver' : 'Activer'}
                    </Button>

                    <Button
                      variant="outline"
                      disabled={deleteMutation.isPending || isSelf || (!isAdminActor && isAdminTarget)}
                      onClick={() => {
                        if (isSelf) return;
                        if (!isAdminActor && isAdminTarget) return;
                        pushToast({
                          kind: 'info',
                          title: 'Confirmation requise',
                          message: `Supprimer l'utilisateur ${display} ?`,
                          actionLabel: 'Confirmer',
                          onAction: () => {
                            deleteMutation.mutate(String(u.id), {
                              onSuccess: () => toast('success', 'Utilisateur supprimé'),
                              onError: (e: any) => {
                                const resp = e?.response?.data;
                                toast('error', 'Suppression impossible', String(resp?.message ?? resp?.detail ?? e?.message ?? e));
                              },
                            });
                          },
                          ttlMs: 6000,
                        });
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatedModal
        open={roleEditorOpen}
        onClose={() => setRoleEditorOpen(false)}
        title={roleEditor.id ? 'Modifier un rôle' : 'Créer un rôle'}
        description="ID + nom + permissions (liste contrôlée)."
        maxWidthClassName="max-w-2xl"
      >
        {roleEditorError && (
          <div className="mb-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--danger)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 text-sm text-[color:var(--danger)]">
            {roleEditorError}
          </div>
        )}

        <div className="grid gap-4">
          <Input
            label="Role ID"
            value={roleEditor.id}
            onChange={(e) => setRoleEditor((p) => ({ ...p, id: e.target.value }))}
            placeholder="ex: supervisor"
            autoComplete="off"
            disabled={!roleEditorIsNew}
          />
          <Input
            label="Nom"
            value={roleEditor.name}
            onChange={(e) => setRoleEditor((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nom affiché"
            autoComplete="off"
          />

          <div>
            <div className="text-sm font-medium text-[color:var(--fg-muted)] mb-2">Permissions</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {allPermissions.map((p) => {
                const checked = roleEditor.permissions.includes(p);
                return (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-3 py-2 text-xs text-[color:var(--fg)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setRoleEditor((prev) => {
                          const set = new Set(prev.permissions);
                          if (next) set.add(p);
                          else set.delete(p);
                          return { ...prev, permissions: Array.from(set) };
                        });
                      }}
                    />
                    {p}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setRoleEditorOpen(false)} disabled={roleEditorBusy}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                setRoleEditorBusy(true);
                setRoleEditorError(null);
                try {
                  const id = String(roleEditor.id || '').trim();
                  const name = String(roleEditor.name || '').trim();
                  const permissions = Array.from(new Set(roleEditor.permissions.map((x) => String(x || '').trim()).filter(Boolean)));
                  if (!roleEditor.id) {
                    setRoleEditorError("L'ID du rôle est requis.");
                    return;
                  }
                  if (!name) {
                    setRoleEditorError('Le nom du rôle est requis.');
                    return;
                  }
                  if (permissions.length === 0) {
                    setRoleEditorError('Sélectionnez au moins une permission.');
                    return;
                  }

                  if (roleMap.has(id)) {
                    await roleUpdateMutation.mutateAsync({ id, name, permissions });
                    toast('success', 'Rôle mis à jour');
                  } else {
                    await roleCreateMutation.mutateAsync({ id, name, permissions });
                    toast('success', 'Rôle créé');
                  }
                  setRoleEditorOpen(false);
                } catch (e: any) {
                  const resp = e?.response?.data;
                  setRoleEditorError(String(resp?.message ?? resp?.detail ?? resp?.error ?? e?.message ?? e));
                } finally {
                  setRoleEditorBusy(false);
                }
              }}
              disabled={roleEditorBusy}
            >
              {roleEditorBusy ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>
      </AnimatedModal>

      <AnimatedModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Créer un utilisateur"
        description="Email/password (Firebase) + rôle + statut."
        maxWidthClassName="max-w-lg"
      >
        {createError && (
          <div className="mb-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--danger)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 text-sm text-[color:var(--danger)]">
            {createError}
          </div>
        )}

        <div className="grid gap-4">
          <Input
            label="Nom d'utilisateur"
            value={form.displayName}
            onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            placeholder="Identifiant de connexion"
            autoComplete="off"
          />
          <Input
            label="Email (optionnel, pour Firebase)"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="email@exemple.com"
          />
          <Input
            label="Mot de passe"
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            placeholder="Min. 8 caractères"
            autoComplete="new-password"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[color:var(--fg-muted)] mb-1">Rôle</label>
              <select
                value={form.roleId}
                onChange={(e) => setForm((p) => ({ ...p, roleId: e.target.value as any }))}
                className="w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-2.5 text-sm text-[color:var(--fg)] focus:outline-none transition focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]"
              >
                {isAdminActor && <option value="admin">Admin</option>}
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm text-[color:var(--fg-muted)]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                />
                Actif
              </label>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                setCreating(true);
                setCreateError(null);
                try {
                  if (!form.displayName?.trim()) {
                    setCreateError("Le nom d'utilisateur est requis.");
                    return;
                  }
                  if (!form.password || form.password.length < 8) {
                    setCreateError('Mot de passe requis (min 8 caractères).');
                    return;
                  }
                  await createMutation.mutateAsync();
                  setCreateOpen(false);
                  setForm({ displayName: '', email: '', password: '', roleId: 'employee', active: true });
                } catch (e: unknown) {
                  const resp = (e as any)?.response?.data;
                  setCreateError(String(resp?.message ?? resp?.detail ?? (e as any)?.message ?? e));
                } finally {
                  setCreating(false);
                }
              }}
              disabled={creating}
            >
              {creating ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </div>
      </AnimatedModal>
    </div>
  );
}

function NotificationsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/settings/notifications?limit=20');
      return res.data;
    }
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/api/settings/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/settings/notifications/read-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--fg)]">Notifications</h2>
          <p className="text-sm text-[color:var(--fg-subtle)] mt-1">{data?.unread_count || 0} non lues</p>
        </div>
        <Button variant="secondary" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
          Tout marquer comme lu
        </Button>
      </div>

      <div className="space-y-2">
        {data?.items?.length === 0 && (
          <Card className="text-center py-12 text-[color:var(--fg-subtle)]">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Aucune notification</p>
          </Card>
        )}
        {data?.items?.map((n: any) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className=""
          >
            <Card className="w-full">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg border ${
                    n.read
                      ? 'border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--surface-1)_70%,transparent)]'
                      : 'border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)]'
                  }`}
                >
                  <Bell className={`h-4 w-4 ${n.read ? 'text-[color:var(--fg-muted)]' : 'text-[color:var(--accent-strong)]'}`} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-[color:var(--fg)]">{n.title}</div>
                  {n.message && <div className="text-sm text-[color:var(--fg-subtle)] mt-1">{n.message}</div>}
                  <div className="text-xs text-[color:var(--fg-muted)] mt-2">
                    {new Date(n.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markReadMutation.mutate(n.id)}
                    className="text-xs text-[color:var(--accent-strong)] hover:underline"
                  >
                    Marquer lu
                  </button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function BackupTab() {
  const queryClient = useQueryClient();
  const hasElectronBackup = typeof window !== 'undefined' && Boolean(window.electronAPI?.backup);
  const { data, isLoading } = useQuery({
    queryKey: ['backups'],
    staleTime: 60_000,
    queryFn: async () => {
      if (hasElectronBackup) {
        const list = await window.electronAPI!.backup.list();
        const items = (list || []).map((b: any) => ({
          id: String(b.filename ?? ''),
          filename: String(b.filename ?? ''),
          size: Number(b.size ?? 0),
          type: 'electron',
          created_at: Number(b.createdAt ?? Date.now()),
          created_by: null,
        }));
        return { items };
      }
      return { items: [] };
    }
  });

  const backupMutation = useMutation({
    mutationFn: async () => {
      if (!hasElectronBackup) {
        throw new Error('electron_backup_unavailable');
      }
      const res = await window.electronAPI!.backup.create();
      if (!res?.success) {
        throw new Error(String(res?.error || 'backup_failed'));
      }
      return res;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      pushToast({ kind: 'success', title: 'Sauvegarde créée', message: res?.filename });
    },
    onError: (e: any) => {
      pushToast({ kind: 'error', title: 'Erreur de sauvegarde', message: String(e?.message ?? 'Erreur') });
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Sauvegarde & Données</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Gérez les sauvegardes de la base de données</p>
      </div>

      {!hasElectronBackup && (
        <Card className="p-4">
          <div className="text-sm text-[color:var(--fg-subtle)]">
            Les sauvegardes sont disponibles uniquement dans l'application Electron.
          </div>
        </Card>
      )}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[color:var(--fg)]">Créer une sauvegarde</h3>
          <p className="text-sm text-[color:var(--fg-subtle)]">Téléchargez une copie de la base de données</p>
        </div>
        <Button onClick={() => backupMutation.mutate()} disabled={!hasElectronBackup || backupMutation.isPending}>
          <Database className="h-4 w-4 mr-2" />
          {backupMutation.isPending ? 'Création...' : 'Nouvelle sauvegarde'}
        </Button>
      </Card>

      <div>
        <h3 className="font-medium text-[color:var(--fg)] mb-3">Historique des sauvegardes</h3>
        <div className="space-y-2">
          {data?.items?.length === 0 && (
            <Card className="text-center py-8 text-[color:var(--fg-subtle)]">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucune sauvegarde</p>
            </Card>
          )}
          {data?.items?.map((backup: any) => (
            <Card
              key={backup.id}
              className="p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg border border-[color:color-mix(in_srgb,var(--color-secondary-500)_26%,transparent)] bg-[color:color-mix(in_srgb,var(--color-secondary-500)_10%,transparent)]">
                  <FileText className="h-4 w-4 text-[color:var(--color-secondary-600)]" />
                </div>
                <div>
                  <div className="font-medium text-sm text-[color:var(--fg)]">{backup.filename}</div>
                  <div className="text-xs text-[color:var(--fg-subtle)]">
                    {(backup.size / 1024 / 1024).toFixed(2)} MB • {new Date(backup.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                backup.type === 'manual'
                  ? 'border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[color:var(--accent-strong)]'
                  : 'border border-[color:var(--border-soft)] bg-[color:var(--glass-bg)] text-[color:var(--fg-muted)]'
              }`}>
                {backup.type}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppearanceTab() {
  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ['user', 'me'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/api/users/me');
      return res.data;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch('/api/users/me', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    }
  });

  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null);

  const serverTheme = user?.theme === 'dark' ? 'dark' : 'light';
  let savedTheme: 'light' | 'dark' | null = null;
  try {
    const saved = window.localStorage.getItem('lver34.theme');
    savedTheme = saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    // ignore
  }

  const theme: 'light' | 'dark' = themeOverride ?? savedTheme ?? serverTheme;

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const applyTheme = (next: 'light' | 'dark') => {
    setThemeOverride(next);
    try {
      window.localStorage.setItem('lver34.theme', next);
    } catch {
      // ignore
    }
    updateMutation.mutate({ theme: next });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Apparence</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Personnalisez l'interface</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-[color:var(--fg)]">Thème</h3>
        <div className="grid grid-cols-1 gap-4 max-w-xl sm:grid-cols-2">
          <button
            onClick={() => applyTheme('light')}
            className={`theme-choice group relative overflow-hidden rounded-2xl border p-5 text-start transition-all focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${
              theme === 'light'
                ? 'border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] shadow-[var(--shadow-control-hover)]'
                : 'border-[color:var(--border-soft)] hover:border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] hover:shadow-[var(--shadow-control)]'
            }`}
          >
            <div className="relative flex items-center gap-4">
              <div
                className="theme-choice-icon flex h-11 w-11 items-center justify-center rounded-xl border"
              >
                <Sun className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold text-[color:var(--fg)]">Clair</div>
                  {theme === 'light' && (
                    <span
                      className="theme-choice-badge inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold"
                    >
                      <Check className="h-3 w-3" />
                      Actif
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">Parisian Pearl</div>
              </div>
            </div>
            <div
              className="theme-preview theme-preview-light relative mt-4 h-16 overflow-hidden rounded-xl border"
            />
          </button>

          <button
            onClick={() => applyTheme('dark')}
            className={`theme-choice group relative overflow-hidden rounded-2xl border p-5 text-start transition-all focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${
              theme === 'dark'
                ? 'border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] shadow-[var(--shadow-control-hover)]'
                : 'border-[color:var(--border-soft)] hover:border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] hover:shadow-[var(--shadow-control)]'
            }`}
          >
            <div className="relative flex items-center gap-4">
              <div
                className="theme-choice-icon flex h-11 w-11 items-center justify-center rounded-xl border"
              >
                <Moon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold text-[color:var(--fg)]">Sombre</div>
                  {theme === 'dark' && (
                    <span
                      className="theme-choice-badge inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold"
                    >
                      <Check className="h-3 w-3" />
                      Actif
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">Midnight Velvet</div>
              </div>
            </div>
            <div
              className="theme-preview theme-preview-dark relative mt-4 h-16 overflow-hidden rounded-xl border"
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function LicenseTab() {
  const [licenseKey, setLicenseKey] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: licenseInfo, refetch } = useQuery({
    queryKey: ['license', 'info'],
    staleTime: 60_000,
    queryFn: async () => {
      if (window.electronAPI?.license) {
        return await window.electronAPI.license.info();
      }
      return { activated: false, reason: 'not_desktop' };
    }
  });

  const activateMutation = useMutation({
    mutationFn: async (key: string) => {
      if (window.electronAPI?.license) {
        return await window.electronAPI.license.activate(key, 0);
      }
      return { success: false, error: 'Not a desktop app' };
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setMessage({ type: 'success', text: 'Licence activée avec succès!' });
        refetch();
        setLicenseKey('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur d\'activation' });
      }
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (window.electronAPI?.license) {
        return await window.electronAPI.license.deactivate();
      }
      return { success: false };
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Licence désactivée' });
      refetch();
    }
  });

  const handleActivate = () => {
    if (!licenseKey.trim()) return;
    activateMutation.mutate(licenseKey.trim());
  };

  const fmtDate = (ms?: number | null) => {
    if (!ms) return '-';
    try {
      return new Date(ms).toLocaleString('fr-FR');
    } catch {
      return '-';
    }
  };

  const graceDays = typeof licenseInfo?.offlineGraceDaysRemaining === 'number' ? licenseInfo.offlineGraceDaysRemaining : null;
  const graceTotal = 7;
  const gracePercent = graceDays === null ? 0 : Math.max(0, Math.min(100, Math.round((graceDays / graceTotal) * 100)));

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Gestion de Licence</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Gérez la licence de votre application</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === 'success'
              ? 'border-[color:color-mix(in_srgb,var(--success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] text-[color:var(--success)]'
              : 'border-[color:color-mix(in_srgb,var(--danger)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] text-[color:var(--danger)]'
          }`}
        >
          {message.text}
        </div>
      )}

      {licenseInfo?.activated ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] p-2">
                    <Check className="h-5 w-5 text-[color:var(--success)]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[color:var(--fg)]">Licence Active</h3>
                    <div className="mt-1 text-sm text-[color:var(--fg-subtle)]">
                      {licenseInfo.offline ? 'Mode hors-ligne' : 'Validée en ligne'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {licenseInfo.plan && (
                    <span className="rounded-full border border-[color:color-mix(in_srgb,var(--success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] px-3 py-1 text-xs font-semibold text-[color:var(--success)]">
                      Plan: {String(licenseInfo.plan).toUpperCase()}
                    </span>
                  )}
                  {licenseInfo.type && (
                    <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-3 py-1 text-xs font-semibold text-[color:var(--fg-muted)]">
                      Type: {licenseInfo.type === 'lifetime' ? 'LIFETIME' : 'SUBSCRIPTION'}
                    </span>
                  )}
                  {typeof licenseInfo.devicesAllowed === 'number' && typeof licenseInfo.deviceCount === 'number' && (
                    <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-3 py-1 text-xs font-semibold text-[color:var(--fg-muted)]">
                      Devices: {licenseInfo.deviceCount}/{licenseInfo.devicesAllowed}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_82%,var(--surface-1))] p-4 shadow-glass">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--fg-muted)]">License Key</div>
                  <div className="mt-2 font-mono text-sm text-[color:var(--fg)]">
                    <code className="rounded-lg bg-[color:color-mix(in_srgb,var(--surface-1)_70%,transparent)] px-2 py-1">{licenseInfo.key}</code>
                  </div>
                </div>

                <div className="rounded-xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_82%,var(--surface-1))] p-4 shadow-glass">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--fg-muted)]">Machine ID</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="font-mono text-sm text-[color:var(--fg)] truncate">{licenseInfo.machineId || '-'}</div>
                    <Button
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(String(licenseInfo.machineId || ''))}
                      className="h-8 px-3"
                    >
                      Copier
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_82%,var(--surface-1))] p-4 shadow-glass">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--fg-muted)]">Activation date</div>
                  <div className="mt-2 text-sm font-semibold text-[color:var(--fg)]">{fmtDate(licenseInfo.activationDate)}</div>
                </div>

                <div className="rounded-xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_82%,var(--surface-1))] p-4 shadow-glass">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--fg-muted)]">Expiration date</div>
                  <div className="mt-2 text-sm font-semibold text-[color:var(--fg)]">
                    {licenseInfo.expiresAt ? fmtDate(licenseInfo.expiresAt) : 'Lifetime'}
                  </div>
                  {typeof licenseInfo.daysRemaining === 'number' && (
                    <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">{licenseInfo.daysRemaining} jours restants</div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--fg)]">Offline grace</div>
                  <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">7 jours après la dernière validation en ligne</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[color:var(--fg)]">{graceDays ?? 0}</div>
                  <div className="text-xs text-[color:var(--fg-subtle)]">jours restants</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--surface-1)_70%,transparent)]">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${gracePercent}%`, background: 'var(--gradient-primary)' }}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-xs text-[color:var(--fg-muted)]">
                  <div className="flex items-center justify-between">
                    <span>Dernière validation en ligne</span>
                    <span className="font-semibold text-[color:var(--fg)]">{fmtDate(licenseInfo.lastOnlineAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Statut</span>
                    <span
                      className={
                        licenseInfo.offline
                          ? 'font-semibold text-[color:var(--color-secondary-700)]'
                          : 'font-semibold text-[color:var(--success)]'
                      }
                    >
                      {licenseInfo.offline ? 'Offline' : 'Online'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Button variant="outline" onClick={() => deactivateMutation.mutate()} className="w-full text-[color:var(--danger)]">
                  Désactiver la licence
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold text-[color:var(--fg)] mb-2">Licence Non Active</h3>
            <p className="text-sm text-[color:var(--fg-subtle)] mb-4">Entrez votre clé de licence pour activer l'application.</p>
            <div className="flex gap-2">
              <Input
                placeholder="LVR34-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Button onClick={handleActivate} disabled={activateMutation.isPending}>
                {activateMutation.isPending ? 'Activation...' : 'Activer'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function UpdateTab() {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [installing, setInstalling] = useState(false);

  const [updateSettings, setUpdateSettings] = useState<any>(null);

  const { data: persistedUpdateSettings } = useQuery({
    queryKey: ['update', 'settings'],
    staleTime: 60_000,
    queryFn: async () => {
      if (window.electronAPI?.update) {
        return await window.electronAPI.update.getSettings();
      }
      return { autoCheck: true, lastCheck: null, skipVersion: null, installMode: 'onQuit' };
    }
  });

  const { data: currentVersion } = useQuery({
    queryKey: ['update', 'version'],
    staleTime: 60_000,
    queryFn: async () => {
      if (window.electronAPI?.update) {
        return await window.electronAPI.update.getVersion();
      }
      return '1.0.0';
    }
  });

  const effectiveCurrentVersion = String(status?.currentVersion || currentVersion || '1.0.0');

  const checkUpdate = async () => {
    setChecking(true);
    try {
      if (window.electronAPI?.update) {
        const result = await window.electronAPI.update.check();
        setUpdateInfo(result);
      }
    } catch (e: any) {
      pushToast({ kind: 'error', title: 'Vérification échouée', message: String(e?.message ?? 'Erreur réseau') });
    }
    setChecking(false);
  };

  useEffect(() => {
    if (!window.electronAPI?.update?.onStatus) return;
    const unsubscribe = window.electronAPI.update.onStatus((payload: any) => {
      setStatus(payload);
    });
    return () => {
      try {
        unsubscribe?.();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!persistedUpdateSettings) return;
    setUpdateSettings((prev: any) => {
      if (prev) return prev;
      return {
        ...persistedUpdateSettings,
        installMode: persistedUpdateSettings?.installMode === 'manual' ? 'manual' : 'onQuit'
      };
    });
  }, [persistedUpdateSettings]);

  const saveUpdateSettings = async () => {
    try {
      if (window.electronAPI?.update && updateSettings) {
        await window.electronAPI.update.saveSettings(updateSettings);
        await checkUpdate();
      }
    } catch {
      // ignore
    }
  };

  const restartAndInstall = async () => {
    setInstalling(true);
    try {
      await window.electronAPI?.update?.quitAndInstall?.();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[color:var(--border-soft)] pb-4">
        <h2 className="text-xl font-semibold text-[color:var(--fg)]">Mises à jour</h2>
        <p className="text-sm text-[color:var(--fg-subtle)] mt-1">Vérifiez les mises à jour disponibles</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-[color:var(--fg-subtle)]">Version actuelle</p>
            <p className="text-2xl font-bold text-[color:var(--fg)]">{effectiveCurrentVersion}</p>
          </div>
          <Button onClick={checkUpdate} disabled={checking}>
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Vérification...' : 'Vérifier les mises à jour'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[color:var(--fg-muted)] mb-1">Installation</label>
            <select
              className="w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-2.5 text-sm text-[color:var(--fg)] focus:outline-none transition focus-visible:shadow-[var(--focus-ring)] focus-visible:border-[color:var(--accent)]"
              value={updateSettings?.installMode || 'onQuit'}
              onChange={(e) => setUpdateSettings((s: any) => ({ ...(s || {}), installMode: e.target.value }))}
            >
              <option value="onQuit">Installer à la fermeture</option>
              <option value="manual">Manuel (Redémarrer & installer)</option>
            </select>
            <p className="mt-1 text-xs text-[color:var(--fg-subtle)]">Recommandé: installer à la fermeture pour une expérience fluide.</p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={saveUpdateSettings} disabled={!updateSettings}>
            Enregistrer
          </Button>
        </div>

        {status?.state && (
          <div className="mt-4 space-y-2">
            {status.state === 'checking' && (
              <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--glass-bg)] p-4 text-sm font-medium text-[color:var(--fg)] shadow-glass">
                Recherche de mises à jour...
              </div>
            )}
            {status.state === 'available' && (
              <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] p-4 text-sm font-medium text-[color:var(--success)]">
                Mise à jour disponible. Téléchargement en arrière-plan...
              </div>
            )}
            {status.state === 'downloading' && (
              <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--color-secondary-500)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--color-secondary-500)_10%,transparent)] p-4">
                <div className="flex items-center justify-between text-sm font-medium text-[color:var(--color-secondary-700)]">
                  <span>Téléchargement...</span>
                  <span>{Math.round(status?.progress?.percent || 0)}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--surface-1)_70%,transparent)]">
                  <div
                    className="h-full transition-all"
                    style={{
                      background: 'var(--gradient-secondary)',
                      width: `${Math.round(status?.progress?.percent || 0)}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {status.state === 'downloaded' && (
              <Card className="p-4">
                <div className="text-sm font-medium text-[color:var(--success)]">Mise à jour prête à être installée.</div>
                <div className="mt-3 flex items-center gap-2">
                  {updateSettings?.installMode === 'manual' ? (
                    <>
                      <Button onClick={restartAndInstall} disabled={installing}>
                        {installing ? 'Installation...' : 'Redémarrer & installer'}
                      </Button>
                      <div className="text-xs text-[color:var(--fg-subtle)]">Le logiciel va redémarrer pour terminer la mise à jour.</div>
                    </>
                  ) : (
                    <div className="text-xs text-[color:var(--fg-muted)]">L'installation se fera automatiquement à la fermeture de l'application.</div>
                  )}
                </div>
              </Card>
            )}
            {status.state === 'not_available' && (
              <Card className="p-4 text-sm text-[color:var(--fg-muted)] shadow-glass">
                Aucune mise à jour disponible.
              </Card>
            )}
            {status.state === 'error' && (
              <Card className="p-4 text-sm text-[color:var(--danger)]">
                Erreur de mise à jour: {status.error || 'unknown'}
              </Card>
            )}
          </div>
        )}

        {updateInfo && (
          <div
            className={`mt-4 p-4 rounded-xl border ${
              updateInfo.updateAvailable
                ? 'border-[color:color-mix(in_srgb,var(--success)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)]'
                : 'border-[color:var(--border-soft)] bg-[color:var(--glass-bg)]'
            }`}
          >
            {updateInfo.updateAvailable ? (
              <div>
                <div className="flex items-center gap-2 text-[color:var(--success)] font-medium mb-2">
                  <RefreshCw className="h-4 w-4" />
                  Mise à jour disponible: {updateInfo.latestVersion}
                </div>
                {updateInfo.releaseNotes && (
                  <p className="text-sm text-[color:var(--fg-muted)]">{updateInfo.releaseNotes}</p>
                )}
              </div>
            ) : (
              <p className="text-[color:var(--fg-muted)]">Vous avez la dernière version</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const me = useAuth((s) => s.user);
  const canManageUsers = Boolean(me?.permissions?.includes('manage_users'));
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const renderTab = () => {
    switch (activeTab) {
      case 'general': return <GeneralTab />;
      case 'store': return <StoreTab />;
      case 'legal': return <LegalTab />;
      case 'invoice': return <InvoiceTab />;
      case 'profile': return <ProfileTab />;
      case 'roles': return <RolesTab />;
      case 'notifications': return <NotificationsTab />;
      case 'backup': return <BackupTab />;
      case 'appearance': return <AppearanceTab />;
      case 'license': return <LicenseTab />;
      case 'update': return <UpdateTab />;
      default: return <GeneralTab />;
    }
  };

  const mainTabs = tabs.filter(t => t.category === 'main');
  const accountTabs = tabs.filter((t) => {
    if (t.category !== 'account') return false;
    if (t.id === 'roles' && !canManageUsers) return false;
    return true;
  });
  const systemTabs = tabs.filter(t => t.category === 'system');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto"
    >
      <div className="lux-page-banner mb-6">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm mt-1">Configurez votre boutique et l'application</p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex min-h-[600px]">
          <div className="w-72 bg-[color:color-mix(in_srgb,var(--glass-bg)_70%,var(--surface-1))] border-r border-[color:var(--glass-border)] p-4">
            <nav className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-[color:var(--fg-muted)] uppercase tracking-wider mb-2 px-3">Principal</h3>
                <div className="space-y-1">
                  {mainTabs.map((tab, i) => (
                    <motion.button
                      key={tab.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-[color:color-mix(in_srgb,var(--glass-bg)_82%,var(--surface-1))] text-[color:var(--accent-strong)] shadow-glass border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)]'
                          : 'text-[color:var(--fg-muted)] hover:bg-[color:color-mix(in_srgb,var(--surface-1)_60%,transparent)]'
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[color:var(--fg-muted)] uppercase tracking-wider mb-2 px-3">Compte</h3>
                <div className="space-y-1">
                  {accountTabs.map((tab, i) => (
                    <motion.button
                      key={tab.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (mainTabs.length + i) * 0.03 }}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-[color:color-mix(in_srgb,var(--glass-bg)_82%,var(--surface-1))] text-[color:var(--accent-strong)] shadow-glass border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)]'
                          : 'text-[color:var(--fg-muted)] hover:bg-[color:color-mix(in_srgb,var(--surface-1)_60%,transparent)]'
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[color:var(--fg-muted)] uppercase tracking-wider mb-2 px-3">Système</h3>
                <div className="space-y-1">
                  {systemTabs.map((tab, i) => (
                    <motion.button
                      key={tab.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (mainTabs.length + accountTabs.length + i) * 0.03 }}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-[color:color-mix(in_srgb,var(--glass-bg)_82%,var(--surface-1))] text-[color:var(--accent-strong)] shadow-glass border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)]'
                          : 'text-[color:var(--fg-muted)] hover:bg-[color:color-mix(in_srgb,var(--surface-1)_60%,transparent)]'
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </nav>
          </div>

          <div className="flex-1 p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {renderTab()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default SettingsPage;
