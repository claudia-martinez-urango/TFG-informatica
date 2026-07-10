import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  getTeacherAnalyticsFilters,
  getTeacherAnalyticsStudents,
  getTeacherAnalyticsSummary,
  getTeacherAnalyticsWordStats,
  getTeacherAnalyticsBloom,
  getTeacherAnalyticsStudentComparison,
  getTeacherAnalyticsWordDetail,
  getTeacherAnalyticsWordBloom,
} from '../api/analyticsApi';
import DashboardStatCard from '../components/dashboard/DashboardStatCard';
import DashboardBarChart from '../components/dashboard/DashboardBarChart';

const BLOOM_LABELS = {
  remember:   'Remember',
  understand: 'Understand',
  apply:      'Apply',
  analyze:    'Analyze',
  evaluate:   'Evaluate',
  create:     'Create',
};

const SORT_MODES = [
  { key: 'difficult', label: 'Most Difficult' },
  { key: 'popular',   label: 'Most Popular'  },
  { key: 'mastered',  label: 'Best Mastered' },
];

const MASTERY_BUCKETS = [
  { key: 'zero', label: '0% (not mastered)', test: (r) => r === 0 },
  { key: 'low',   label: '1–29%',            test: (r) => r > 0  && r < 30  },
  { key: 'mid',   label: '30–69%',           test: (r) => r >= 30 && r < 70 },
  { key: 'high',  label: '70–99%',           test: (r) => r >= 70 && r < 100 },
  { key: 'full',  label: '100% (mastered)',  test: (r) => r === 100 },
];

const BUCKET_PAGE_SIZE = 15;

function uniqueBy(arr, key) {
  const seen = new Set();
  return arr.filter(item => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function masteryBadgeClass(rate) {
  if (rate === null || rate === undefined) return 'analytics-mastery-badge analytics-mastery-badge--low';
  if (rate >= 70) return 'analytics-mastery-badge analytics-mastery-badge--high';
  if (rate >= 30) return 'analytics-mastery-badge analytics-mastery-badge--medium';
  return 'analytics-mastery-badge analytics-mastery-badge--low';
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TeacherAnalyticsPage() {
  const { profile } = useAuth();

  const [filterData,       setFilterData]       = useState([]);
  const [students,         setStudents]         = useState([]);
  const [selectedFolder,   setSelectedFolder]   = useState('');
  const [selectedSection,  setSelectedSection]  = useState('');
  const [selectedReading,  setSelectedReading]  = useState('');
  const [selectedStudent,  setSelectedStudent]  = useState('');
  const [summary,          setSummary]          = useState(null);
  const [wordStats,        setWordStats]        = useState([]);
  const [bloom,            setBloom]            = useState([]);
  const [comparison,       setComparison]       = useState([]);
  const [sortMode,         setSortMode]         = useState('difficult');
  const [loading,          setLoading]          = useState(true);
  const [dataLoading,      setDataLoading]      = useState(false);

  const [selectedBucket,     setSelectedBucket]     = useState(null);
  const [bucketPage,         setBucketPage]         = useState(0);

  const [selectedWord,       setSelectedWord]       = useState(null);
  const [wordDetail,         setWordDetail]         = useState([]);
  const [wordDetailLoading,  setWordDetailLoading]  = useState(false);
  const wordDetailRef = useRef(null);

  // ── Cascade dropdown options ─────────────────────────────────
  const folders = useMemo(
    () => uniqueBy(filterData, 'folder_id').map(r => ({ id: r.folder_id, name: r.folder_name })),
    [filterData]
  );

  const sections = useMemo(() => {
    const f = selectedFolder ? filterData.filter(r => r.folder_id === selectedFolder) : filterData;
    return uniqueBy(f, 'section_id').map(r => ({ id: r.section_id, name: r.section_name }));
  }, [filterData, selectedFolder]);

  const readings = useMemo(() => {
    let f = filterData;
    if (selectedFolder)  f = f.filter(r => r.folder_id  === selectedFolder);
    if (selectedSection) f = f.filter(r => r.section_id === selectedSection);
    return uniqueBy(f, 'reading_id').map(r => ({ id: r.reading_id, title: r.reading_title }));
  }, [filterData, selectedFolder, selectedSection]);

  // ── Load filter options + all students on mount ───────────────
  useEffect(() => {
    Promise.all([
      getTeacherAnalyticsFilters(),
      getTeacherAnalyticsStudents(null),
    ])
      .then(([filters, studs]) => {
        setFilterData(filters);
        setStudents(studs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Refresh student list when folder changes ─────────────────
  useEffect(() => {
    if (loading) return;
    getTeacherAnalyticsStudents(selectedFolder || null)
      .then(studs => {
        setStudents(studs);
        if (selectedStudent && !studs.find(s => s.student_id === selectedStudent)) {
          setSelectedStudent('');
        }
      })
      .catch(() => {});
  }, [loading, selectedFolder]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load analytics data when filters change (or initial load) ─
  useEffect(() => {
    if (loading) return; // wait until filter options are loaded
    async function load() {
      setDataLoading(true);
      try {
        const fId  = selectedFolder  || null;
        const sId  = selectedSection || null;
        const rId  = selectedReading || null;
        const stId = selectedStudent || null;

        const [summaryData, wordData, bloomData, compData] = await Promise.all([
          getTeacherAnalyticsSummary(fId, sId, rId, stId),
          getTeacherAnalyticsWordStats(fId, sId, rId, stId),
          getTeacherAnalyticsBloom(fId, sId, rId, stId),
          stId ? Promise.resolve([]) : getTeacherAnalyticsStudentComparison(fId, sId, rId),
        ]);
        setSummary(summaryData);
        setWordStats(wordData);
        setBloom(bloomData);
        setComparison(compData);
      } catch {
        // non-critical
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, [loading, selectedFolder, selectedSection, selectedReading, selectedStudent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter handlers ──────────────────────────────────────────
  function onFolderChange(e) {
    setSelectedFolder(e.target.value);
    setSelectedSection('');
    setSelectedReading('');
    setSelectedStudent('');
  }
  function onSectionChange(e) {
    setSelectedSection(e.target.value);
    setSelectedReading('');
  }
  function onReset() {
    setSelectedFolder('');
    setSelectedSection('');
    setSelectedReading('');
    setSelectedStudent('');
  }

  async function onWordBarClick(item) {
    const word = {
      selected_text:     item.selected_text ?? item.label,
      reading_id:        item.reading_id,
      reading_title:     item.reading_title,
      students_saved:    item.students_saved,
      students_mastered: item.students_mastered,
    };
    setSelectedWord(word);
    setWordDetail([]);
    setWordDetailLoading(true);
    try {
      const [detail, bloomRows] = await Promise.all([
        getTeacherAnalyticsWordDetail(word.selected_text, word.reading_id),
        getTeacherAnalyticsWordBloom(word.selected_text, word.reading_id),
      ]);
      const bloomMap = {};
      for (const b of bloomRows) bloomMap[b.student_id] = b;
      setWordDetail(detail.map(d => ({
        ...d,
        bloom_total:    Number(bloomMap[d.student_id]?.bloom_total    ?? 0),
        bloom_answered: Number(bloomMap[d.student_id]?.bloom_answered ?? 0),
      })));
    } catch {
      setWordDetail([]);
    } finally {
      setWordDetailLoading(false);
    }
    setTimeout(() => wordDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  // ── Derived chart / table data ───────────────────────────────
  const masteryBucketData = useMemo(
    () => MASTERY_BUCKETS.map((bucket) => ({
      key:   bucket.key,
      label: bucket.label,
      count: wordStats.filter((w) => bucket.test(w.mastery_rate ?? 0)).length,
    })),
    [wordStats]
  );

  const bucketWords = useMemo(() => {
    if (!selectedBucket) return [];
    const bucket = MASTERY_BUCKETS.find((b) => b.key === selectedBucket);
    if (!bucket) return [];
    return [...wordStats]
      .filter((w) => bucket.test(w.mastery_rate ?? 0))
      .sort((a, b) => b.students_saved - a.students_saved);
  }, [wordStats, selectedBucket]);

  const totalBucketPages = Math.max(1, Math.ceil(bucketWords.length / BUCKET_PAGE_SIZE));
  const pagedBucketWords = bucketWords.slice(
    bucketPage * BUCKET_PAGE_SIZE,
    (bucketPage + 1) * BUCKET_PAGE_SIZE
  );

  function onMasteryBucketClick(item) {
    setSelectedBucket((prev) => (prev === item.key ? null : item.key));
    setBucketPage(0);
  }

  const popularWords = useMemo(
    () => [...wordStats].sort((a, b) => b.students_saved - a.students_saved).slice(0, 12),
    [wordStats]
  );

  const bloomChartData = useMemo(
    () => bloom.map(b => ({
      label:         BLOOM_LABELS[b.bloom_level] ?? b.bloom_level,
      answered_count: b.answered_count,
    })),
    [bloom]
  );

  const comparisonChartData = useMemo(
    () => comparison.map(s => ({
      label:        s.student_name,
      mastery_rate: s.mastery_rate ?? 0,
      terms_added:  s.terms_added,
      student_id:   s.student_id,
    })),
    [comparison]
  );

  const sortedTableData = useMemo(() => {
    const copy = [...wordStats];
    if (sortMode === 'difficult') return copy.sort((a, b) => (a.mastery_rate ?? 101) - (b.mastery_rate ?? 101));
    if (sortMode === 'popular')   return copy.sort((a, b) => b.students_saved - a.students_saved);
    return copy.sort((a, b) => (b.mastery_rate ?? -1) - (a.mastery_rate ?? -1));
  }, [wordStats, sortMode]);

  const hasActiveFilter = selectedFolder || selectedSection || selectedReading || selectedStudent;
  const singleStudentMode = Boolean(selectedStudent);
  const selectedStudentName = singleStudentMode
    ? students.find(s => s.student_id === selectedStudent)?.student_name ?? 'Student'
    : null;

  if (loading) {
    return (
      <main className="page">
        <p style={{ color: 'var(--text-muted)', padding: '40px 24px' }}>Loading analytics…</p>
      </main>
    );
  }

  return (
    <main className="page analytics-page">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h2>Class Analytics</h2>
          <p>
            {singleStudentMode
              ? `Viewing analytics for ${selectedStudentName}.`
              : 'Explore vocabulary and Bloom activity data across your folders and students.'}
          </p>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <section className="analytics-filter-section">
        <div className="analytics-filter-bar">

          <div className="analytics-filter-group">
            <label className="analytics-filter-label">Folder</label>
            <select className="analytics-filter-select" value={selectedFolder} onChange={onFolderChange}>
              <option value="">All Folders</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div className="analytics-filter-group">
            <label className="analytics-filter-label">Unit / Section</label>
            <select
              className="analytics-filter-select"
              value={selectedSection}
              onChange={onSectionChange}
              disabled={!selectedFolder}
            >
              <option value="">All Sections</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="analytics-filter-group">
            <label className="analytics-filter-label">Reading</label>
            <select
              className="analytics-filter-select"
              value={selectedReading}
              onChange={e => setSelectedReading(e.target.value)}
              disabled={!selectedSection}
            >
              <option value="">All Readings</option>
              {readings.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>

          <div className="analytics-filter-group">
            <label className="analytics-filter-label">Student</label>
            <select
              className="analytics-filter-select"
              value={selectedStudent}
              onChange={e => setSelectedStudent(e.target.value)}
            >
              <option value="">All Students</option>
              {students.map(s => (
                <option key={s.student_id} value={s.student_id}>
                  {s.student_name} ({s.terms_count} terms)
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilter && (
            <button type="button" className="analytics-filter-reset" onClick={onReset}>
              ✕ Reset
            </button>
          )}
        </div>
      </section>

      {dataLoading && (
        <p className="analytics-loading-hint">Updating…</p>
      )}

      {/* ── Summary cards ─────────────────────────────────────── */}
      {summary && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">
            {singleStudentMode ? `${selectedStudentName}'s Overview` : 'Class Overview'}
          </h2>
          <div className="dashboard-stats-grid">
            {!singleStudentMode && (
              <DashboardStatCard label="Active Students" value={summary.total_students} />
            )}
            <DashboardStatCard label="Terms Saved"    value={summary.terms_saved}      />
            <DashboardStatCard label="Terms Mastered" value={summary.terms_mastered}   variant="success" />
            <DashboardStatCard
              label={singleStudentMode ? 'Mastery Rate' : 'Avg Mastery Rate'}
              value={summary.avg_mastery_rate !== null ? `${summary.avg_mastery_rate}%` : '—'}
              variant="success"
            />
            <DashboardStatCard label="Bloom Activities" value={summary.bloom_answers} />
          </div>
        </section>
      )}

      {/* ── Charts row 1: Difficult words + Student comparison ─── */}
      <section className="dashboard-section">
        <div className="analytics-charts-grid">

          {/* Most difficult words — mastery distribution histogram */}
          <div className="analytics-chart-block">
            <h3 className="analytics-chart-title">Word Mastery Distribution</h3>
            <p className="analytics-chart-caption">How many words fall into each mastery range.</p>
            {wordStats.length === 0 ? (
              <p className="analytics-chart-caption">No vocabulary data yet.</p>
            ) : (
              <>
                <DashboardBarChart
                  data={masteryBucketData}
                  labelKey="label"
                  valueKey="count"
                  color="warning"
                  emptyMessage="No data."
                  onBarClick={onMasteryBucketClick}
                />
                <p className="analytics-click-hint">Click a range to see which words fall into it.</p>
              </>
            )}
          </div>

          {/* Student comparison OR single-student bloom */}
          {singleStudentMode ? (
            <div className="analytics-chart-block">
              <h3 className="analytics-chart-title">Bloom Activities — {selectedStudentName}</h3>
              {bloomChartData.length === 0 ? (
                <p className="analytics-chart-caption">No Bloom activities recorded for this student.</p>
              ) : (
                <DashboardBarChart
                  data={bloomChartData}
                  labelKey="label"
                  valueKey="answered_count"
                  color="primary"
                  emptyMessage="No data."
                />
              )}
            </div>
          ) : (
            <div className="analytics-chart-block">
              <h3 className="analytics-chart-title">Student Comparison</h3>
              <p className="analytics-chart-caption">
                Mastery rate per student.
                {comparisonChartData.length > 0 && (
                  <span className="analytics-click-hint"> Click a bar to filter by student.</span>
                )}
              </p>
              {comparisonChartData.length === 0 ? (
                <p className="analytics-chart-caption">No student data yet.</p>
              ) : (
                <DashboardBarChart
                  data={comparisonChartData}
                  labelKey="label"
                  valueKey="mastery_rate"
                  unit="%"
                  color="primary"
                  emptyMessage="No data."
                  onBarClick={(item) => setSelectedStudent(item.student_id)}
                />
              )}
            </div>
          )}

        </div>
      </section>

      {/* ── Mastery bucket reveal (full width, not cramped in a 2-col chart block) ── */}
      {selectedBucket && (
        <section className="dashboard-section analytics-bucket-reveal">
          <div className="word-detail-header">
            <h4 className="word-detail-title">
              {MASTERY_BUCKETS.find((b) => b.key === selectedBucket)?.label}
              {' — '}{bucketWords.length} word{bucketWords.length !== 1 ? 's' : ''}
            </h4>
            <button
              type="button"
              className="word-detail-close"
              onClick={() => setSelectedBucket(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {bucketWords.length === 0 ? (
            <p className="analytics-chart-caption">No words in this range.</p>
          ) : (
            <>
              <div className="analytics-table-wrapper">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Word</th>
                      <th>Reading</th>
                      <th>Folder</th>
                      <th>{singleStudentMode ? 'Saved' : 'Students Saved'}</th>
                      <th>Mastery %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBucketWords.map((w, i) => (
                      <tr
                        key={`${w.selected_text}-${w.reading_id}-${i}`}
                        className="analytics-table-row--clickable"
                        onClick={() => onWordBarClick(w)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onWordBarClick(w); }}
                      >
                        <td><strong>{w.selected_text}</strong></td>
                        <td>{w.reading_title}</td>
                        <td>{w.folder_name}</td>
                        <td className="analytics-table-num">{w.students_saved}</td>
                        <td>
                          <span className={masteryBadgeClass(w.mastery_rate)}>
                            {w.mastery_rate ?? 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalBucketPages > 1 && (
                <div className="analytics-table-pagination">
                  <button
                    type="button"
                    className="analytics-page-btn"
                    onClick={() => setBucketPage((p) => Math.max(0, p - 1))}
                    disabled={bucketPage === 0}
                  >
                    ◀
                  </button>
                  <span className="analytics-page-indicator">
                    Page {bucketPage + 1} of {totalBucketPages}
                  </span>
                  <button
                    type="button"
                    className="analytics-page-btn"
                    onClick={() => setBucketPage((p) => Math.min(totalBucketPages - 1, p + 1))}
                    disabled={bucketPage >= totalBucketPages - 1}
                  >
                    ▶
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Charts row 2: Bloom + Most saved ─────────────────────  */}
      {!singleStudentMode && (
        <section className="dashboard-section">
          <div className="analytics-charts-grid">

            {/* Bloom by level */}
            <div className="analytics-chart-block">
              <h3 className="analytics-chart-title">Bloom Activities by Level</h3>
              <p className="analytics-chart-caption">Activities answered across all students.</p>
              {bloomChartData.length === 0 ? (
                <p className="analytics-chart-caption">No Bloom activities recorded yet.</p>
              ) : (
                <DashboardBarChart
                  data={bloomChartData}
                  labelKey="label"
                  valueKey="answered_count"
                  color="info"
                  emptyMessage="No data."
                />
              )}
            </div>

            {/* Most saved words */}
            <div className="analytics-chart-block">
              <h3 className="analytics-chart-title">Most Saved Words</h3>
              <p className="analytics-chart-caption">Words students save the most.</p>
              {popularWords.length === 0 ? (
                <p className="analytics-chart-caption">No vocabulary data yet.</p>
              ) : (
                <>
                  <DashboardBarChart
                    data={popularWords.map(w => ({
                      label:             w.selected_text,
                      students_saved:    w.students_saved,
                      selected_text:     w.selected_text,
                      reading_id:        w.reading_id,
                      reading_title:     w.reading_title,
                      mastery_rate:      w.mastery_rate,
                      students_mastered: w.students_mastered,
                    }))}
                    labelKey="label"
                    valueKey="students_saved"
                    color="success"
                    emptyMessage="No data."
                    onBarClick={onWordBarClick}
                  />
                  <p className="analytics-click-hint">Click a bar to see which students saved this word.</p>
                </>
              )}
            </div>

          </div>
        </section>
      )}

      {/* ── Word detail panel ────────────────────────────────────  */}
      {selectedWord && (
        <section className="dashboard-section word-detail-panel" ref={wordDetailRef}>
          <div className="word-detail-header">
            <div>
              <h2 className="word-detail-title">"{selectedWord.selected_text}"</h2>
              <p className="word-detail-meta">
                {selectedWord.reading_title && <span>{selectedWord.reading_title} · </span>}
                {selectedWord.students_saved != null && (
                  <span>{selectedWord.students_saved} student{selectedWord.students_saved !== 1 ? 's' : ''} saved · </span>
                )}
                {selectedWord.students_mastered != null && (
                  <span>{selectedWord.students_mastered} mastered</span>
                )}
              </p>
            </div>
            <button
              type="button"
              className="word-detail-close"
              onClick={() => { setSelectedWord(null); setWordDetail([]); }}
              aria-label="Close detail panel"
            >
              ✕
            </button>
          </div>

          {wordDetailLoading ? (
            <p className="analytics-loading-hint">Loading student details…</p>
          ) : wordDetail.length === 0 ? (
            <p className="analytics-chart-caption">No student data found for this word.</p>
          ) : (
            <div className="analytics-table-wrapper">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Saved on</th>
                    <th>Bloom Activities</th>
                    <th>Bloom Answered</th>
                  </tr>
                </thead>
                <tbody>
                  {wordDetail.map(d => (
                    <tr key={d.student_id}>
                      <td><strong>{d.student_name}</strong></td>
                      <td>
                        <span className={d.is_mastered
                          ? 'analytics-mastery-badge analytics-mastery-badge--high'
                          : 'analytics-mastery-badge analytics-mastery-badge--low'
                        }>
                          {d.is_mastered ? 'Mastered' : 'Learning'}
                        </span>
                      </td>
                      <td className="analytics-table-date">{formatDate(d.saved_at)}</td>
                      <td className="analytics-table-num">{d.bloom_total > 0 ? d.bloom_total : '—'}</td>
                      <td className="analytics-table-num">{d.bloom_total > 0 ? d.bloom_answered : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Word statistics table ────────────────────────────────  */}
      {wordStats.length > 0 && (
        <section className="dashboard-section">
          <div className="analytics-word-table-header">
            <h2 className="dashboard-section-title">
              Word Statistics
              <span className="analytics-count-badge">{wordStats.length}</span>
            </h2>
            <div className="analytics-word-sort-tabs">
              {SORT_MODES.map(m => (
                <button
                  key={m.key}
                  type="button"
                  className={`analytics-word-sort-tab${sortMode === m.key ? ' analytics-word-sort-tab--active' : ''}`}
                  onClick={() => setSortMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="analytics-table-wrapper">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Word</th>
                  <th>Reading</th>
                  <th>Section</th>
                  <th>Folder</th>
                  <th>{singleStudentMode ? 'Saved' : 'Students Saved'}</th>
                  <th>{singleStudentMode ? 'Mastered' : 'Students Mastered'}</th>
                  <th>Mastery %</th>
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((w, i) => (
                  <tr
                    key={`${w.selected_text}-${w.reading_id}-${i}`}
                    className="analytics-table-row--clickable"
                    onClick={() => onWordBarClick(w)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onWordBarClick(w); }}
                  >
                    <td><strong>{w.selected_text}</strong></td>
                    <td>{w.reading_title}</td>
                    <td>{w.section_name}</td>
                    <td>{w.folder_name}</td>
                    <td className="analytics-table-num">{w.students_saved}</td>
                    <td className="analytics-table-num">{w.students_mastered}</td>
                    <td>
                      <span className={masteryBadgeClass(w.mastery_rate)}>
                        {w.mastery_rate !== null ? `${w.mastery_rate}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!dataLoading && summary && summary.terms_saved === 0 && (
        <section className="dashboard-section">
          <div className="dashboard-empty-state">
            No student vocabulary data yet for the selected filters.
            Students need to save words from your readings to generate analytics.
          </div>
        </section>
      )}

    </main>
  );
}

export default TeacherAnalyticsPage;
