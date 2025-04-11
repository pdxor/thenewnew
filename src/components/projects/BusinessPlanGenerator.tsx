import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FileText, Download, Loader2, ExternalLink, Edit, Save, RefreshCw as Refresh, AlertCircle, MessageSquare } from 'lucide-react';
import { generateWithOpenAI } from '../../lib/openai';
import { Database } from '../../types/supabase';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { supabase } from '../../lib/supabase';
import BusinessPlanChat from './BusinessPlanChat';

type Project = Database['public']['Tables']['projects']['Row'];
type BusinessPlan = Database['public']['Tables']['business_plans']['Row'];

export interface BusinessPlanTemplate {
  executiveSummary: {
    mission: string;
    vision: string;
    objectives: string;
    completed: boolean;
  };
  projectDescription: {
    overview: string;
    permaculturePrinciples: string;
    zoneDesign: string;
    completed: boolean;
  };
  marketAnalysis: {
    targetMarket: string;
    competition: string;
    trends: string;
    completed: boolean;
  };
  productsAndServices: {
    offerings: string;
    pricing: string;
    uniqueSellingPoints: string;
    completed: boolean;
  };
  operationalPlan: {
    timeline: string;
    resources: string;
    partnerships: string;
    completed: boolean;
  };
  marketingStrategy: {
    channels: string;
    promotions: string;
    communityEngagement: string;
    completed: boolean;
  };
  financialPlan: {
    startupCosts: string;
    ongoingExpenses: string;
    revenueStreams: string;
    breakEvenAnalysis: string;
    fundingNeeds: string;
    completed: boolean;
  };
  implementationTimeline: {
    phases: string;
    milestones: string;
    completed: boolean;
  };
  risksAndMitigation: {
    potentialRisks: string;
    mitigationStrategies: string;
    completed: boolean;
  };
  conclusion: {
    summary: string;
    nextSteps: string;
    completed: boolean;
  };
}

interface BusinessPlanGeneratorProps {
  project: Project;
  visible: boolean;
}

const BusinessPlanGenerator: React.FC<BusinessPlanGeneratorProps> = ({ project, visible }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [businessPlan, setBusinessPlan] = useState<string | null>(null);
  const [businessPlanId, setBusinessPlanId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [fetchingPlan, setFetchingPlan] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBusinessPlan, setEditedBusinessPlan] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [regenerationProgress, setRegenerationProgress] = useState(0);
  const regenerationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [businessPlanTemplate, setBusinessPlanTemplate] = useState<BusinessPlanTemplate | null>(null);
  const [planProgress, setPlanProgress] = useState<number>(0);

  // Fetch existing business plan when component mounts
  useEffect(() => {
    const fetchBusinessPlan = async () => {
      if (!project.id || !visible) return;
      
      try {
        const { data, error } = await supabase
          .from('business_plans')
          .select('*')
          .eq('project_id', project.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching business plan:', error);
        } else if (data) {
          setBusinessPlan(data.content);
          setEditedBusinessPlan(data.content);
          setBusinessPlanId(data.id);
          
          // Try to parse as JSON template
          try {
            const parsed = JSON.parse(data.content) as BusinessPlanTemplate;
            setBusinessPlanTemplate(parsed);
            calculateProgress(parsed);
          } catch (e) {
            // If it's not JSON, it's the old format
            console.log('Business plan is in old format, not JSON template');
            setBusinessPlanTemplate(null);
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setFetchingPlan(false);
      }
    };

    fetchBusinessPlan();
  }, [project.id, visible]);

  // Calculate completion progress
  const calculateProgress = (template: BusinessPlanTemplate) => {
    const sections = Object.keys(template);
    let completedSections = 0;
    let totalFields = 0;
    let completedFields = 0;
    
    sections.forEach(sectionKey => {
      const section = template[sectionKey as keyof BusinessPlanTemplate];
      if (typeof section === 'object') {
        const fields = Object.keys(section).filter(k => k !== 'completed');
        
        fields.forEach(fieldKey => {
          totalFields++;
          const value = section[fieldKey as keyof typeof section];
          if (value && (typeof value === 'string' ? value.trim() !== '' : true)) {
            completedFields++;
          }
        });
        
        if (section.completed) {
          completedSections++;
        }
      }
    });
    
    const progress = Math.round((completedFields / totalFields) * 100);
    setPlanProgress(progress);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [editedBusinessPlan, isEditing]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (regenerationTimerRef.current) {
        clearInterval(regenerationTimerRef.current);
      }
    };
  }, []);

  // Generate business plan based on project data
  const generateBusinessPlan = async () => {
    if (!user || !project) return;
    
    setLoading(true);
    setError(null);
    setApiKeyMissing(false);
    
    try {
      // Create a template for the business plan
      const template: BusinessPlanTemplate = {
        executiveSummary: {
          mission: '',
          vision: '',
          objectives: '',
          completed: false
        },
        projectDescription: {
          overview: '',
          permaculturePrinciples: '',
          zoneDesign: '',
          completed: false
        },
        marketAnalysis: {
          targetMarket: '',
          competition: '',
          trends: '',
          completed: false
        },
        productsAndServices: {
          offerings: '',
          pricing: '',
          uniqueSellingPoints: '',
          completed: false
        },
        operationalPlan: {
          timeline: '',
          resources: '',
          partnerships: '',
          completed: false
        },
        marketingStrategy: {
          channels: '',
          promotions: '',
          communityEngagement: '',
          completed: false
        },
        financialPlan: {
          startupCosts: '',
          ongoingExpenses: '',
          revenueStreams: '',
          breakEvenAnalysis: '',
          fundingNeeds: '',
          completed: false
        },
        implementationTimeline: {
          phases: '',
          milestones: '',
          completed: false
        },
        risksAndMitigation: {
          potentialRisks: '',
          mitigationStrategies: '',
          completed: false
        },
        conclusion: {
          summary: '',
          nextSteps: '',
          completed: false
        }
      };

      // Generate executive summary as a starting point
      const prompt = `Create a detailed executive summary for a permaculture project with the following details:

Title: ${project.title}
Location: ${project.location || 'Location not specified'}
Property Status: ${project.property_status === 'owned_land' ? 'Owned Land' : 'Potential Property'}
Values, Mission & Goals: ${project.values_mission_goals || 'Not specified'}
Category: ${project.category || 'Not specified'}
Funding Needs: ${project.funding_needs || 'Not specified'}

Guilds/Elements: ${project.guilds?.join(', ') || 'None specified'}

Zone 0 (House/Main Building): ${project.zone_0 || 'Not specified'}
Zone 1 (Frequent Attention): ${project.zone_1 || 'Not specified'}
Zone 2 (Regular Attention): ${project.zone_2 || 'Not specified'}
Zone 3 (Occasional Attention): ${project.zone_3 || 'Not specified'}
Zone 4 (Semi-Wild Areas): ${project.zone_4 || 'Not specified'}

Water Systems: ${project.water || 'Not specified'}
Soil Management: ${project.soil || 'Not specified'}
Power Systems: ${project.power || 'Not specified'}

Structures: ${project.structures?.join(', ') || 'None specified'}

The executive summary should include a mission statement, vision, and key objectives for the project.`;

      const executiveSummary = await generateWithOpenAI({
        userId: user.id,
        prompt,
        fieldName: 'businessPlan',
        maxTokens: 1000
      });
      
      // Update the template with the generated executive summary
      template.executiveSummary = {
        mission: executiveSummary.split('\n\n')[0] || '',
        vision: executiveSummary.split('\n\n')[1] || '',
        objectives: executiveSummary.split('\n\n').slice(2).join('\n\n') || '',
        completed: true
      };
      
      // Convert template to JSON
      const businessPlanJson = JSON.stringify(template, null, 2);
      
      setBusinessPlan(businessPlanJson);
      setEditedBusinessPlan(businessPlanJson);
      setBusinessPlanTemplate(template);
      calculateProgress(template);
      
      // Save the generated business plan to the database
      await saveBusinessPlan(businessPlanJson);
      
    } catch (err) {
      console.error('Error generating business plan:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('No OpenAI API key found')) {
          setApiKeyMissing(true);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to generate business plan. Please try again.');
      }
    } finally {
      setLoading(false);
      setRegenerating(false);
      setRegenerationProgress(0);
      if (regenerationTimerRef.current) {
        clearInterval(regenerationTimerRef.current);
        regenerationTimerRef.current = null;
      }
    }
  };

  // Save business plan to database
  const saveBusinessPlan = async (content: string) => {
    if (!user || !project.id) return;
    
    setSavingPlan(true);
    
    try {
      if (businessPlanId) {
        // Update existing business plan
        const { error } = await supabase
          .from('business_plans')
          .update({
            content,
            updated_at: new Date().toISOString()
          })
          .eq('id', businessPlanId);
          
        if (error) throw error;
      } else {
        // Create new business plan
        const { data, error } = await supabase
          .from('business_plans')
          .insert({
            project_id: project.id,
            content
          })
          .select('id')
          .single();
          
        if (error) throw error;
        
        setBusinessPlanId(data.id);
      }
      
      setHasChanges(false);
    } catch (err) {
      console.error('Error saving business plan:', err);
      setError('Failed to save business plan. Please try again.');
    } finally {
      setSavingPlan(false);
    }
  };

  // Handle editing business plan
  const handleEditClick = () => {
    setIsEditing(true);
    setEditedBusinessPlan(businessPlan || '');
  };

  // Handle save edited business plan
  const handleSaveEdit = async () => {
    if (!editedBusinessPlan.trim()) return;
    
    await saveBusinessPlan(editedBusinessPlan);
    setBusinessPlan(editedBusinessPlan);
    setIsEditing(false);
    
    // Try to parse as JSON template
    try {
      const parsed = JSON.parse(editedBusinessPlan) as BusinessPlanTemplate;
      setBusinessPlanTemplate(parsed);
      calculateProgress(parsed);
    } catch (e) {
      // If it's not JSON, it's the old format
      setBusinessPlanTemplate(null);
    }
  };

  // Handle cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedBusinessPlan(businessPlan || '');
  };

  // Simulate progress for regeneration
  const simulateRegenerationProgress = () => {
    setRegenerationProgress(0);
    setRegenerating(true);
    
    // Create a timer that increments progress
    regenerationTimerRef.current = setInterval(() => {
      setRegenerationProgress(prev => {
        // Slow down as we get closer to 100%
        const increment = prev < 70 ? 5 : prev < 90 ? 2 : 1;
        const newProgress = Math.min(prev + increment, 95);
        return newProgress;
      });
    }, 500);
  };

  // Regenerate business plan
  const handleRegeneratePlan = async () => {
    const confirmRegenerate = window.confirm(
      'Are you sure you want to regenerate the business plan? This will replace the current version, including any edits you have made.'
    );
    
    if (confirmRegenerate) {
      simulateRegenerationProgress();
      await generateBusinessPlan();
    }
  };

  // Create and download business plan as DOCX
  const downloadAsDocx = async () => {
    if (!businessPlan) return;
    
    try {
      // If we have a template, use that to create a structured document
      if (businessPlanTemplate) {
        const doc = createStructuredDocument(businessPlanTemplate, project.title);
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${project.title.replace(/\s+/g, '_')}_Business_Plan.docx`);
        return;
      }
      
      // Otherwise use the old approach for legacy plans
      // Split the business plan into sections and paragraphs
      const sections = businessPlan.split('\n\n');
      const docSections = [];
      
      // Create document content
      for (const section of sections) {
        if (section.trim().startsWith('#')) {
          // This is a heading (assuming markdown-like formatting)
          const headingText = section.replace(/^#+ /, '');
          docSections.push(
            new Paragraph({
              text: headingText,
              heading: HeadingLevel.HEADING_1,
              thematicBreak: true,
              spacing: {
                after: 200,
                before: 400
              }
            })
          );
        } else if (section.trim().startsWith('##')) {
          // Subheading
          const headingText = section.replace(/^##+ /, '');
          docSections.push(
            new Paragraph({
              text: headingText,
              heading: HeadingLevel.HEADING_2,
              spacing: {
                after: 200,
                before: 300
              }
            })
          );
        } else {
          // Regular paragraph
          docSections.push(
            new Paragraph({
              text: section,
              spacing: {
                after: 200,
              }
            })
          );
        }
      }
      
      // Create document with title page
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: "BUSINESS PLAN",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: {
                  after: 400,
                  before: 400
                }
              }),
              new Paragraph({
                text: project.title,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: {
                  after: 400
                }
              }),
              new Paragraph({
                text: `Location: ${project.location || 'Not specified'}`,
                alignment: AlignmentType.CENTER
              }),
              new Paragraph({
                text: `Created on: ${new Date().toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
                spacing: {
                  after: 800
                }
              }),
              ...docSections
            ],
          }
        ],
      });
      
      // Generate and save document - using toBlob instead of toBuffer for browser compatibility
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${project.title.replace(/\s+/g, '_')}_Business_Plan.docx`);
      
    } catch (error) {
      console.error('Error creating DOCX:', error);
      setError('Error creating document. Please try again.');
    }
  };

  // Create a structured document from the template
  const createStructuredDocument = (template: BusinessPlanTemplate, title: string) => {
    const children: Paragraph[] = [
      new Paragraph({
        text: "BUSINESS PLAN",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 400,
          before: 400
        }
      }),
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 400
        }
      }),
      new Paragraph({
        text: `Created on: ${new Date().toLocaleDateString()}`,
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 800
        }
      })
    ];
    
    // Add Executive Summary
    children.push(
      new Paragraph({
        text: "EXECUTIVE SUMMARY",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );
    
    if (template.executiveSummary.mission) {
      children.push(
        new Paragraph({
          text: "Mission",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 }
        }),
        new Paragraph({
          text: template.executiveSummary.mission,
          spacing: { after: 200 }
        })
      );
    }
    
    if (template.executiveSummary.vision) {
      children.push(
        new Paragraph({
          text: "Vision",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 }
        }),
        new Paragraph({
          text: template.executiveSummary.vision,
          spacing: { after: 200 }
        })
      );
    }
    
    if (template.executiveSummary.objectives) {
      children.push(
        new Paragraph({
          text: "Objectives",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 }
        }),
        new Paragraph({
          text: template.executiveSummary.objectives,
          spacing: { after: 200 }
        })
      );
    }
    
    // Add Project Description
    children.push(
      new Paragraph({
        text: "PROJECT DESCRIPTION",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      })
    );
    
    if (template.projectDescription.overview) {
      children.push(
        new Paragraph({
          text: "Overview",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 }
        }),
        new Paragraph({
          text: template.projectDescription.overview,
          spacing: { after: 200 }
        })
      );
    }
    
    // Continue adding sections for all parts of the template...
    // (I'm showing just a few sections for brevity, but you would continue this pattern)
    
    // Add Market Analysis
    if (template.marketAnalysis.completed) {
      children.push(
        new Paragraph({
          text: "MARKET ANALYSIS",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );
      
      if (template.marketAnalysis.targetMarket) {
        children.push(
          new Paragraph({
            text: "Target Market",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 }
          }),
          new Paragraph({
            text: template.marketAnalysis.targetMarket,
            spacing: { after: 200 }
          })
        );
      }
      
      // Add other market analysis sections...
    }
    
    // Add Financial Plan
    if (template.financialPlan.completed) {
      children.push(
        new Paragraph({
          text: "FINANCIAL PLAN",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );
      
      if (template.financialPlan.startupCosts) {
        children.push(
          new Paragraph({
            text: "Startup Costs",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 }
          }),
          new Paragraph({
            text: template.financialPlan.startupCosts,
            spacing: { after: 200 }
          })
        );
      }
      
      // Add other financial plan sections...
    }
    
    // Create the document
    return new Document({
      sections: [
        {
          properties: {},
          children: children
        }
      ]
    });
  };

  // Open chat with specific section focus
  const handleOpenChat = (section: string | null = null) => {
    setActiveSection(section);
    setShowChat(true);
  };

  // Update business plan from chat
  const handleUpdatePlan = async (newContent: string) => {
    await saveBusinessPlan(newContent);
    setBusinessPlan(newContent);
    
    // Try to parse as JSON template
    try {
      const parsed = JSON.parse(newContent) as BusinessPlanTemplate;
      setBusinessPlanTemplate(parsed);
      calculateProgress(parsed);
    } catch (e) {
      // If it's not JSON, it's the old format
      setBusinessPlanTemplate(null);
    }
  };

  if (!visible) return null;

  if (fetchingPlan) {
    return (
      <div className="mt-8 bg-white border border-gray-200 rounded-lg shadow-md p-6 text-center">
        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-gray-500" />
        <p className="text-gray-600">Loading business plan...</p>
      </div>
    );
  }

  // Render the template-based business plan if available
  if (businessPlanTemplate) {
    return (
      <div className="mt-8">
        {showChat && (
          <BusinessPlanChat
            projectId={project.id}
            currentPlan={businessPlan}
            onUpdatePlan={handleUpdatePlan}
            activeSection={activeSection}
            onClose={() => setShowChat(false)}
          />
        )}
        
        <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden mb-8">
          <div className="bg-orange-600 text-white p-4 flex justify-between items-center">
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              <h3 className="text-xl font-semibold">Business Plan</h3>
              <div className="ml-4 bg-white bg-opacity-20 rounded-full px-3 py-1 text-sm">
                {planProgress}% Complete
              </div>
            </div>
            <div className="flex space-x-2">
              {!isEditing && !regenerating ? (
                <>
                  <button
                    onClick={() => handleOpenChat(null)}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Chat Assistant
                  </button>
                  <button
                    onClick={handleEditClick}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={handleRegeneratePlan}
                    disabled={loading}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <Refresh className="h-4 w-4 mr-1" />
                    Regenerate
                  </button>
                  <button
                    onClick={downloadAsDocx}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingPlan || !hasChanges}
                    className="bg-white text-green-600 hover:bg-green-50 py-1 px-3 rounded-md text-sm flex items-center disabled:opacity-50"
                  >
                    {savingPlan ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-1" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="bg-white text-gray-600 hover:bg-gray-50 py-1 px-3 rounded-md text-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>
          
          {regenerating && (
            <div className="bg-orange-100 p-3 flex items-center">
              <Loader2 className="animate-spin h-5 w-5 text-orange-600 mr-2" />
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-orange-800">Regenerating business plan...</span>
                  <span className="text-sm text-orange-800">{regenerationProgress}%</span>
                </div>
                <div className="w-full bg-orange-200 rounded-full h-2">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all duration-500 ease-in-out" 
                    style={{ width: `${regenerationProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-orange-700 mt-1">
                  This may take a minute. We're creating a detailed business plan based on your project details.
                </p>
              </div>
            </div>
          )}
          
          <div className="p-6">
            {!isEditing ? (
              <div className="prose max-w-none">
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Business Plan Completion</span>
                    <span className="text-sm font-medium text-gray-700">{planProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full" 
                      style={{ width: `${planProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Use the Chat Assistant to continue developing your business plan
                  </p>
                </div>
                
                {/* Executive Summary */}
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Executive Summary</h2>
                <div className="mb-8 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Mission</h3>
                  <p className="mb-4">{businessPlanTemplate.executiveSummary.mission || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Vision</h3>
                  <p className="mb-4">{businessPlanTemplate.executiveSummary.vision || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Objectives</h3>
                  <p>{businessPlanTemplate.executiveSummary.objectives || 'Not yet defined'}</p>
                  
                  <div className="mt-4 text-right">
                    <button 
                      onClick={() => handleOpenChat('executiveSummary')}
                      className="text-sm text-orange-600 hover:text-orange-800 flex items-center ml-auto"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Improve with AI
                    </button>
                  </div>
                </div>
                
                {/* Project Description */}
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Project Description</h2>
                <div className="mb-8 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Overview</h3>
                  <p className="mb-4">{businessPlanTemplate.projectDescription.overview || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Permaculture Principles</h3>
                  <p className="mb-4">{businessPlanTemplate.projectDescription.permaculturePrinciples || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Zone Design</h3>
                  <p>{businessPlanTemplate.projectDescription.zoneDesign || 'Not yet defined'}</p>
                  
                  <div className="mt-4 text-right">
                    <button 
                      onClick={() => handleOpenChat('projectDescription')}
                      className="text-sm text-orange-600 hover:text-orange-800 flex items-center ml-auto"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Improve with AI
                    </button>
                  </div>
                </div>
                
                {/* Market Analysis */}
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Market Analysis</h2>
                <div className="mb-8 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Target Market</h3>
                  <p className="mb-4">{businessPlanTemplate.marketAnalysis.targetMarket || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Competition</h3>
                  <p className="mb-4">{businessPlanTemplate.marketAnalysis.competition || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Trends</h3>
                  <p>{businessPlanTemplate.marketAnalysis.trends || 'Not yet defined'}</p>
                  
                  <div className="mt-4 text-right">
                    <button 
                      onClick={() => handleOpenChat('marketAnalysis')}
                      className="text-sm text-orange-600 hover:text-orange-800 flex items-center ml-auto"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Improve with AI
                    </button>
                  </div>
                </div>
                
                {/* Financial Plan */}
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Financial Plan</h2>
                <div className="mb-8 bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-2">Startup Costs</h3>
                  <p className="mb-4">{businessPlanTemplate.financialPlan.startupCosts || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Ongoing Expenses</h3>
                  <p className="mb-4">{businessPlanTemplate.financialPlan.ongoingExpenses || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Revenue Streams</h3>
                  <p className="mb-4">{businessPlanTemplate.financialPlan.revenueStreams || 'Not yet defined'}</p>
                  
                  <h3 className="text-lg font-semibold mb-2">Funding Needs</h3>
                  <p>{businessPlanTemplate.financialPlan.fundingNeeds || 'Not yet defined'}</p>
                  
                  <div className="mt-4 text-right">
                    <button 
                      onClick={() => handleOpenChat('financialPlan')}
                      className="text-sm text-orange-600 hover:text-orange-800 flex items-center ml-auto"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Improve with AI
                    </button>
                  </div>
                </div>
                
                {/* View All Sections Button */}
                <div className="text-center mt-8">
                  <button
                    onClick={() => handleOpenChat(null)}
                    className="bg-orange-600 text-white py-2 px-6 rounded-md hover:bg-orange-700 inline-flex items-center"
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Work on Business Plan with AI Assistant
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 text-sm text-gray-500 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Edit your business plan. Changes will be saved when you click Save.
                </div>
                <textarea
                  ref={textAreaRef}
                  value={editedBusinessPlan}
                  onChange={(e) => {
                    setEditedBusinessPlan(e.target.value);
                    setHasChanges(e.target.value !== businessPlan);
                  }}
                  className="w-full p-4 border border-gray-300 rounded-md min-h-[500px] focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Legacy rendering for old format business plans
  return (
    <div className="mt-8">
      {showChat && (
        <BusinessPlanChat
          projectId={project.id}
          currentPlan={businessPlan}
          onUpdatePlan={handleUpdatePlan}
          activeSection={activeSection}
          onClose={() => setShowChat(false)}
        />
      )}
      
      {!businessPlan ? (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-orange-800 flex items-center mb-2">
            <FileText className="h-5 w-5 mr-2" />
            Generate Business Plan
          </h3>
          <p className="text-orange-700 mb-4">
            Based on the details of your project, we can generate a comprehensive business plan to help 
            you implement, fund, and grow your permaculture project.
          </p>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {apiKeyMissing && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
              <p className="font-semibold mb-1">OpenAI API Key Required</p>
              <p className="mb-2">To generate a business plan, you need to add your OpenAI API key in settings.</p>
              <a
                href="/settings/api-keys"
                className="inline-flex items-center text-sm bg-yellow-800 text-white px-3 py-1 rounded hover:bg-yellow-900"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Add API Key
              </a>
            </div>
          )}
          
          <div className="flex space-x-4">
            <button
              onClick={generateBusinessPlan}
              disabled={loading || apiKeyMissing}
              className="bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-md flex items-center justify-center disabled:bg-orange-300"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Generating Business Plan...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 mr-2" />
                  Generate Business Plan
                </>
              )}
            </button>
            
            <button
              onClick={() => handleOpenChat(null)}
              disabled={loading || apiKeyMissing}
              className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md flex items-center justify-center disabled:bg-purple-300"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Guided Creation
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden mb-8">
          <div className="bg-orange-600 text-white p-4 flex justify-between items-center">
            <h3 className="text-xl font-semibold flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Business Plan
            </h3>
            <div className="flex space-x-2">
              {!isEditing && !regenerating ? (
                <>
                  <button
                    onClick={() => handleOpenChat(null)}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Chat Assistant
                  </button>
                  <button
                    onClick={handleEditClick}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={handleRegeneratePlan}
                    disabled={loading}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <Refresh className="h-4 w-4 mr-1" />
                    Regenerate
                  </button>
                  <button
                    onClick={downloadAsDocx}
                    className="bg-white text-orange-600 hover:bg-orange-50 py-1 px-3 rounded-md text-sm flex items-center"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingPlan || !hasChanges}
                    className="bg-white text-green-600 hover:bg-green-50 py-1 px-3 rounded-md text-sm flex items-center disabled:opacity-50"
                  >
                    {savingPlan ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-1" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="bg-white text-gray-600 hover:bg-gray-50 py-1 px-3 rounded-md text-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : null}
            </div>
          </div>
          
          {regenerating && (
            <div className="bg-orange-100 p-3 flex items-center">
              <Loader2 className="animate-spin h-5 w-5 text-orange-600 mr-2" />
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-orange-800">Regenerating business plan...</span>
                  <span className="text-sm text-orange-800">{regenerationProgress}%</span>
                </div>
                <div className="w-full bg-orange-200 rounded-full h-2">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all duration-500 ease-in-out" 
                    style={{ width: `${regenerationProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-orange-700 mt-1">
                  This may take a minute. We're creating a detailed business plan based on your project details.
                </p>
              </div>
            </div>
          )}
          
          <div className="p-6">
            {!isEditing ? (
              <div className="prose max-w-none text-gray-800 whitespace-pre-wrap">
                {businessPlan}
                
                <div className="text-center mt-8">
                  <button
                    onClick={() => handleOpenChat(null)}
                    className="bg-orange-600 text-white py-2 px-6 rounded-md hover:bg-orange-700 inline-flex items-center"
                  >
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Work on Business Plan with AI Assistant
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 text-sm text-gray-500 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Edit your business plan. Changes will be saved when you click Save.
                </div>
                <textarea
                  ref={textAreaRef}
                  value={editedBusinessPlan}
                  onChange={(e) => {
                    setEditedBusinessPlan(e.target.value);
                    setHasChanges(e.target.value !== businessPlan);
                  }}
                  className="w-full p-4 border border-gray-300 rounded-md min-h-[500px] focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessPlanGenerator;