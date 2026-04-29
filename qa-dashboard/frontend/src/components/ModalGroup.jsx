import React from 'react';
import { CheckSquare } from 'lucide-react';
import TestClosureModal from './TestClosureModal';
import QuickClosureModal from './QuickClosureModal';
import ReportGeneratorModal from './ReportGeneratorModal';

/**
 * ModalGroup — encapsulates the 3 modal state hooks, the trigger buttons,
 * and the modal renders for Dashboard4's report/closure actions.
 *
 * Props:
 *   metrics      — full metrics object passed to Dashboard4
 *   project      — current project object
 *   useBusiness  — boolean (default true) — French/business labels
 *   isDark       — boolean (default false) — dark theme flag
 */
const ModalGroup = ({ metrics, project, useBusiness = true, isDark = false }) => {
    const [showClosureModal, setShowClosureModal] = React.useState(false);
    const [showQuickClosureModal, setShowQuickClosureModal] = React.useState(false);
    const [showReportGenerator, setShowReportGenerator] = React.useState(false);

    return (
        <>
            {/* Trigger buttons — rendered inline where ModalGroup is placed */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                    onClick={() => setShowClosureModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        backgroundColor: '#3B82F6', color: 'white', border: 'none',
                        padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 600,
                        cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2563EB'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3B82F6'}
                >
                    <CheckSquare size={16} /> Clôture de Test
                </button>
                <button
                    onClick={() => setShowQuickClosureModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        backgroundColor: '#10B981', color: 'white', border: 'none',
                        padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 600,
                        cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10B981'}
                >
                    <CheckSquare size={16} /> Quick Clôture DOCX
                </button>
                <button
                    onClick={() => setShowReportGenerator(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        backgroundColor: '#8B5CF6', color: 'white', border: 'none',
                        padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 600,
                        cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#7C3AED'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#8B5CF6'}
                >
                    <CheckSquare size={16} /> Rapport HTML / PPTX
                </button>
            </div>

            {/* Modals */}
            <TestClosureModal
                isOpen={showClosureModal}
                onClose={() => setShowClosureModal(false)}
                metrics={metrics}
                project={project}
                useBusiness={useBusiness}
                isDark={isDark}
            />

            <QuickClosureModal
                isOpen={showQuickClosureModal}
                onClose={() => setShowQuickClosureModal(false)}
                metrics={metrics}
                project={project}
                useBusiness={useBusiness}
                isDark={isDark}
            />

            <ReportGeneratorModal
                isOpen={showReportGenerator}
                onClose={() => setShowReportGenerator(false)}
                metrics={metrics}
                project={project}
                isDark={isDark}
            />
        </>
    );
};

export default ModalGroup;
