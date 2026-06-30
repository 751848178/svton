# Engineering Craft Principles Examples

## 1. Replace boolean variant drift with sibling components

When `compact`, `readonly`, `danger`, and `inline` start changing layout and behavior together, stop stacking flags in one JSX body.

```tsx
// Before
export function ProductCard(props: {
  product: Product;
  compact?: boolean;
  readonly?: boolean;
  danger?: boolean;
  inline?: boolean;
}) {
  if (props.compact) return <CompactLayout {...props} />;

  return (
    <Card inline={props.inline} tone={props.danger ? 'danger' : 'default'}>
      {!props.readonly && <Toolbar product={props.product} />}
      <ProductSummary product={props.product} compact={props.compact} />
      {props.readonly ? <ReadonlyFooter /> : <EditableFooter />}
    </Card>
  );
}
```

```tsx
// After
type ProductCardVariant = 'default' | 'compact' | 'readonly';

export function ProductCard(props: { product: Product; variant: ProductCardVariant }) {
  switch (props.variant) {
    case 'compact':
      return <CompactProductCard product={props.product} />;
    case 'readonly':
      return <ReadonlyProductCard product={props.product} />;
    default:
      return <DefaultProductCard product={props.product} />;
  }
}
```

The hub only dispatches. Each sibling component owns one display intent.

Avoid merely renaming several booleans into one `variant` prop while keeping the whole implementation in a single JSX body. That changes the API surface, not the boundary.

## 2. Delete synchronized derived state

If a value can be calculated from props, query results, or local inputs, do not mirror it into `useState`.

```tsx
// Before
const [fullName, setFullName] = useState('');
const [canSubmit, setCanSubmit] = useState(false);

useEffect(() => {
  setFullName(`${user.firstName} ${user.lastName}`);
}, [user.firstName, user.lastName]);

useEffect(() => {
  setCanSubmit(form.name.trim() !== '' && !saving && permissions.canEdit);
}, [form.name, saving, permissions.canEdit]);
```

```tsx
// After
const fullName = `${user.firstName} ${user.lastName}`;
const canSubmit = form.name.trim() !== '' && !saving && permissions.canEdit;
```

If the calculation is expensive, prefer `useMemo`. Do not create synchronization work just to cache a cheap fact.

## 3. Turn repeated field JSX into descriptors plus a layout skeleton

When the same rendering pattern keeps repeating, move field definition out of JSX and let the view focus on layout.

```tsx
// Before
<section>
  <Row label="Name" value={user.name || '-'} />
  <Row label="Email" value={user.email || '-'} />
  <Row label="Role" value={formatRole(user.role)} />
  <Row label="Created" value={formatDate(user.createdAt)} />
</section>
```

```tsx
// After
const fields = [
  { label: 'Name', value: user.name || '-' },
  { label: 'Email', value: user.email || '-' },
  { label: 'Role', value: formatRole(user.role) },
  { label: 'Created', value: formatDate(user.createdAt) },
];

<DetailList fields={fields} />;
```

```tsx
function DetailList({ fields }: { fields: Array<{ label: string; value: ReactNode }> }) {
  return (
    <section>
      {fields.map((field) => (
        <Row key={field.label} label={field.label} value={field.value} />
      ))}
    </section>
  );
}
```

This keeps formatting logic close to the data, while layout stays stable and reusable.

## 4. Move fallback and retry policy out of the component

The view may render `loading`, `error`, and `ready`, but it should not orchestrate primary source fallback.

```tsx
// Before
export function ProfilePanel({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const primary = await fetchPrimaryProfile(userId);
        if (!cancelled) setProfile(primary);
      } catch {
        const backup = await fetchBackupProfile(userId);
        if (!cancelled) setProfile(backup);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <ProfileView profile={profile} />;
}
```

```tsx
// After
export function ProfilePanel({ userId }: { userId: string }) {
  const profile = useUserProfile(userId);
  return <ProfileView profile={profile.data} loading={profile.loading} error={profile.error} />;
}

function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      try {
        return await fetchPrimaryProfile(userId);
      } catch {
        return await fetchBackupProfile(userId);
      }
    },
  });
}
```

The UI now consumes results. The fallback policy lives with the data-loading contract.

Avoid moving the fallback into a helper that still lives next to the component while the view keeps owning cancellation, retry timing, or source selection. The goal is to move policy into the data-loading contract, not just into a nearby function.
