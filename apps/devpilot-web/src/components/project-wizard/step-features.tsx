'use client';

import { useEffect, useState } from 'react';
import { useProjectConfigStore } from '@/store/project-config';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

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
  const { config, toggleFeature } = useProjectConfigStore();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      const [featuresData, categoriesData] = await Promise.all([
        api.get<Feature[]>('/registry/features'),
        api.get<Category[]>('/registry/categories'),
      ]);
      setFeatures(featuresData);
      setCategories(categoriesData.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error('Failed to load features:', error);
    } finally {
      setLoading(false);
    }
  };

  // 根据选中的子项目过滤可用功能
  const selectedSubProjects = Object.entries(config.subProjects)
    .filter(([, selected]) => selected)
    .map(([id]) => id);

  const isFeatureAvailable = (feature: Feature) => {
    return feature.applicableTo.some((t) => selectedSubProjects.includes(t));
  };

  const getFeaturesByCategory = (categoryId: string) => {
    return features.filter(f => f.category === categoryId && isFeatureAvailable(f));
  };

  const getSelectedPackages = () => {
    const packages = new Set<string>();
    features.forEach((feature) => {
      if (config.features.includes(feature.id)) {
        feature.packages.forEach((pkg) => packages.add(pkg));
      }
    });
    return Array.from(packages);
  };

  const selectedPackages = getSelectedPackages();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">选择功能</h3>
        <p className="text-sm text-muted-foreground mb-4">
          选择你需要的功能，系统会自动添加对应的包
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((category) => {
          const categoryFeatures = getFeaturesByCategory(category.id);
          if (categoryFeatures.length === 0) return null;

          return (
            <div key={category.id}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {category.name}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {categoryFeatures.map((feature) => (
                  <div
                    key={feature.id}
                    onClick={() => toggleFeature(feature.id)}
                    className={cn(
                      'p-3 border rounded-lg cursor-pointer transition-colors',
                      config.features.includes(feature.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-medium text-sm">{feature.name}</h5>
                        <p className="text-xs text-muted-foreground mt-1">
                          {feature.description}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.features.includes(feature.id)}
                        onChange={() => {}}
                        className="w-4 h-4 mt-0.5"
                      />
                    </div>
                    {feature.requiredResources.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {feature.requiredResources.map((r) => (
                          <span
                            key={r}
                            className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded"
                          >
                            需要 {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 已选择的包 */}
      {selectedPackages.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">将添加的包</h4>
          <div className="flex flex-wrap gap-2">
            {selectedPackages.map((pkg) => (
              <code
                key={pkg}
                className="text-xs bg-muted px-2 py-1 rounded"
              >
                {pkg}
              </code>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-2 border rounded-md font-medium hover:bg-accent transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}
