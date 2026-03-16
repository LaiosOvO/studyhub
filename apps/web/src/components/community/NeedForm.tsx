'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

import type { ResearchNeedCreate } from '@/lib/api/community';

interface NeedFormProps {
  readonly onSubmit: (data: ResearchNeedCreate) => Promise<void>;
  readonly initialData?: Partial<ResearchNeedCreate>;
}

export function NeedForm({ onSubmit, initialData }: NeedFormProps) {
  const t = useTranslations('community');

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(
    initialData?.description ?? '',
  );
  const [skills, setSkills] = useState<readonly string[]>(
    initialData?.required_skills ?? [],
  );
  const [direction, setDirection] = useState(
    initialData?.research_direction ?? '',
  );
  const [tags, setTags] = useState<readonly string[]>(
    initialData?.tags ?? [],
  );
  const [skillInput, setSkillInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddSkill = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && skillInput.trim()) {
        e.preventDefault();
        const newSkill = skillInput.trim();
        if (!skills.includes(newSkill)) {
          setSkills([...skills, newSkill]);
        }
        setSkillInput('');
      }
    },
    [skillInput, skills],
  );

  const handleRemoveSkill = useCallback(
    (skill: string) => {
      setSkills(skills.filter((s) => s !== skill));
    },
    [skills],
  );

  const handleAddTag = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && tagInput.trim()) {
        e.preventDefault();
        const newTag = tagInput.trim();
        if (!tags.includes(newTag)) {
          setTags([...tags, newTag]);
        }
        setTagInput('');
      }
    },
    [tagInput, tags],
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      setTags(tags.filter((t) => t !== tag));
    },
    [tags],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!title.trim()) {
        setError('Title is required');
        return;
      }
      if (description.trim().length < 20) {
        setError('Description must be at least 20 characters');
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit({
          title: title.trim(),
          description: description.trim(),
          required_skills: [...skills],
          research_direction: direction.trim() || null,
          tags: [...tags],
        });
      } catch {
        setError('Failed to publish need');
      } finally {
        setSubmitting(false);
      }
    },
    [title, description, skills, direction, tags, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('needs.form.title')} *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('needs.form.description')} *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>

      {/* Required Skills (tag input) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('needs.form.skills')}
        </label>
        <div className="flex flex-wrap gap-1 mb-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700"
            >
              {skill}
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="text-orange-400 hover:text-orange-600"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleAddSkill}
          placeholder={t('needs.form.skillPlaceholder')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Research Direction */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('needs.form.direction')}
        </label>
        <input
          type="text"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Tags (tag input) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('needs.form.tags')}
        </label>
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-gray-400 hover:text-gray-600"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleAddTag}
          placeholder={t('needs.form.skillPlaceholder')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? '...' : t('needs.form.submit')}
      </button>
    </form>
  );
}
