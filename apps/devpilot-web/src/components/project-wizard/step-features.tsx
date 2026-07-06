'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, Tag } from '@svton/ui';
import { useProjectConfigStore } from '@/store/hooks';
import { apiRequest } from '@/lib/api-client';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}
interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  packages: string[];
  requiredResources: string[];
  applicableTo: string[];
}
interface Category {
  id: string;
  name: string;
  order: number;
}

export function StepFeatures({ onNext, onPrev }: StepProps) {
  const t = useTranslations('projectWizard');
  const { config, toggleFeature } = useProjectConfigStore();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Feature[]>('GET:/registry/features')
      .then(setFeatures)
      .catch((e) => console.error(e));
    apiRequest<Category[]>('GET:/registry/categories')
      .then((d) => setCategories(d.sort((a, b) => a.order - b.order)))
      .catch((e) => console.error(e));
    setLoading(false);
  }, []);

  const selectedSubProjects = Object.entries(config.subProjects)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const isAvailable = (f: Feature) => f.applicableTo.some((item) => selectedSubProjects.includes(item));
  const getByCategory = (cid: string) =>
    features.filter((f) => f.category === cid && isAvailable(f));
  const selectedPackages = Array.from(
    new Set(features.filter((f) => config.features.includes(f.id)).flatMap((f) => f.packages)),
  );
  const handleToggle = usePersistFn((id: string) => toggleFeature(id));
  const handleNext = usePersistFn(() => onNext());
  const handlePrev = usePersistFn(() => onPrev());

  if (loading) return <LoadingState text="" />;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-medium">{t('selectFeatures')}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t('selectFeaturesHint')}</p>
      </div>
      <div className="space-y-6">
        {categories.map((cat) => {
          const catFeatures = getByCategory(cat.id);
          if (catFeatures.length === 0) return null;
          return (
            <div key={cat.id}>
              <h4 className="mb-3 text-sm font-medium text-muted-foreground">{cat.name}</h4>
              <div className="grid grid-cols-2 gap-3">
                {catFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    onClick={() => handleToggle(feature.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${config.features.includes(feature.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="text-sm font-medium">{feature.name}</h5>
                        <p className="mt-1 text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.features.includes(feature.id)}
                        onChange={() => {}}
                        className="mt-0.5 h-4 w-4"
                      />
                    </div>
                    {feature.requiredResources.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {feature.requiredResources.map((r) => (
                          <Tag
                            key={r}
                            color="orange"
                          >
                            {t('requires', { resource: r })}
                          </Tag>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {selectedPackages.length > 0 ? (
        <div className="border-t pt-4">
          <h4 className="mb-2 text-sm font-medium">{t('packagesToAdd')}</h4>
          <div className="flex flex-wrap gap-2">
            {selectedPackages.map((pkg) => (
              <code
                key={pkg}
                className="rounded bg-muted px-2 py-1 text-xs"
              >
                {pkg}
              </code>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex justify-between pt-4">
        <button
          onClick={handlePrev}
          className="rounded-md border px-6 py-2 font-medium transition-colors hover:bg-accent"
        >
          {t('prev')}
        </button>
        <button
          onClick={handleNext}
          className="rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('next')}
        </button>
      </div>
    </div>
  );
}
