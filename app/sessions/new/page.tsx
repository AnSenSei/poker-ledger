'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function getLocalDatetime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function NewSessionPage() {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [datetime, setDatetime] = useState(getLocalDatetime);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    setSubmitting(true);
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        note: note.trim() || null,
        created_at: new Date(datetime).toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      alert('创建失败: ' + (error?.message ?? '未知错误'));
      setSubmitting(false);
      return;
    }

    router.push(`/sessions/${data.id}`);
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 py-4 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">新增牌局</h1>
      </div>

      {/* Form */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            时间
          </label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            备注（可选）
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：周五晚老王家"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={submitting}
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-600 text-white rounded-xl py-4 text-lg font-medium transition-colors"
        >
          {submitting ? '创建中...' : '创建牌局'}
        </button>
      </div>
    </div>
  );
}
