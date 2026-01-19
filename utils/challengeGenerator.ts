import { ClassLevel, Board, Stream, MCQItem, SystemSettings } from '../types';
import { getSubjectsList } from '../constants';

export const generateDailyChallengeQuestions = async (
    classLevel: ClassLevel,
    board: Board,
    stream: Stream | null,
    settings: SystemSettings,
    userId: string
): Promise<{ questions: MCQItem[], name: string, id: string }> => {
    
    // 1. Determine Source Chapters & Subjects
    let sourceChapterKeys: string[] = [];
    
    // Get ALL Chapter IDs if AUTO, or Filtered if MANUAL
    if (settings.dailyChallengeConfig?.mode === 'MANUAL' && settings.dailyChallengeConfig.selectedChapterIds?.length) {
        // MANUAL MODE: Use only what Admin selected
        // We need to find the keys that contain these IDs.
        // This is a bit inefficient scan but necessary unless we store full keys.
        const selectedIds = new Set(settings.dailyChallengeConfig.selectedChapterIds);
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('nst_content_')) {
                // Check if this key ends with any of the selected IDs
                // Key format: ..._chapterId
                const parts = key.split('_');
                const chId = parts[parts.length - 1];
                if (selectedIds.has(chId)) {
                    sourceChapterKeys.push(key);
                }
            }
        }
    } else {
        // AUTO MODE: Find ALL chapters for this class/board/stream
        const prefix = `nst_content_${board}_${classLevel}`;
        const streamKey = (classLevel === '11' || classLevel === '12') ? `-${stream}` : '';
        const expectedPrefix = `nst_content_${board}_${classLevel}${streamKey}`;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(expectedPrefix)) {
                sourceChapterKeys.push(key);
            }
        }
    }

    // 2. Aggregate Questions By Subject
    const questionsBySubject: Record<string, MCQItem[]> = {};
    const usedQuestions = new Set<string>();

    for (const key of sourceChapterKeys) {
        try {
            const stored = localStorage.getItem(key);
            if (!stored) continue;
            
            const content = JSON.parse(stored);
            
            // Extract Subject Name from Key or Content
            // Key: nst_content_CBSE_10_Math_ch1
            // We can rely on content.subjectName if available, or parse key
            let subjectName = content.subjectName;
            if (!subjectName) {
                const parts = key.split('_');
                // nst, content, Board, Class, Subject, ...
                // If stream is present in class part (10-Science), index shifts?
                // Let's assume subject is at index 4 usually.
                // But safer to rely on content.subjectName.
                // If missing, group under "General".
                subjectName = "General"; 
            }

            if (!questionsBySubject[subjectName]) {
                questionsBySubject[subjectName] = [];
            }

            const pool = questionsBySubject[subjectName];

            // Collect Manual MCQs
            if (content.manualMcqData && Array.isArray(content.manualMcqData)) {
                content.manualMcqData.forEach((q: MCQItem) => {
                    if (!usedQuestions.has(q.question)) {
                        pool.push(q);
                        usedQuestions.add(q.question);
                    }
                });
            }
            // Collect Weekly Test MCQs
            if (content.weeklyTestMcqData && Array.isArray(content.weeklyTestMcqData)) {
                content.weeklyTestMcqData.forEach((q: MCQItem) => {
                    if (!usedQuestions.has(q.question)) {
                        pool.push(q);
                        usedQuestions.add(q.question);
                    }
                });
            }
        } catch (e) {
            console.error("Error parsing content for challenge", key, e);
        }
    }

    // 3. Balanced Mixing
    const subjects = Object.keys(questionsBySubject);
    let finalQuestions: MCQItem[] = [];
    const TOTAL_TARGET = 50; // Total questions for Daily Challenge

    if (subjects.length > 0) {
        const targetPerSubject = Math.ceil(TOTAL_TARGET / subjects.length);
        
        subjects.forEach(sub => {
            const pool = questionsBySubject[sub];
            // Shuffle pool first
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            
            // Take target amount (or all if less)
            finalQuestions.push(...pool.slice(0, targetPerSubject));
        });
        
        // If we exceeded total (due to ceil), trim randomly later. 
        // If we are under total (some subjects had few Qs), we can do a second pass?
        // For now, simpler is better. We might get 55 Qs, that's fine.
    }

    // 4. Final Shuffle
    for (let i = finalQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
    }

    // Cap at 100 max (hard limit)
    if (finalQuestions.length > 100) {
        finalQuestions = finalQuestions.slice(0, 100);
    }

    // 5. Return formatted object
    const today = new Date().toDateString(); // "Mon Jan 01 2024"
    
    // If no questions found (New User), return a fallback "Welcome Challenge" if possible?
    // Or just empty list, UI handles it.
    
    return {
        id: `daily-challenge-${userId}-${today.replace(/\s/g, '-')}`,
        name: `Daily Challenge (${today})`,
        questions: finalQuestions
    };
};
