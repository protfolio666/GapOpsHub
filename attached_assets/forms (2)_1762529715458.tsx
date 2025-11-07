import { useState, useEffect } from "react";
import { purgeProblematicReports } from "@/services/problematic-reports-purge";
import { useAuth } from "@/context/auth-context";
import { dispatchFormUpdate } from "./audits";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Trash2, Copy, Edit, Check, X, Eye, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import ConditionalFormRenderer from "@/components/conditional-form-renderer";

// Helper function to generate IDs
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

interface Question {
  id: string;
  text: string;
  type: "text" | "dropdown" | "multiSelect" | "number" | "date" | "partner";
  options?: string;
  weightage: number;
  deductionPoints?: number;
  mandatory: boolean;
  isFatal: boolean;
  enableRemarks: boolean;
  grazingLogic: boolean;
  grazingPercentage?: number;
  // Conditional subdropdown fields
  showSubDropdownOn?: string[]; // Values that trigger showing the subdropdown (e.g., ["No", "Fatal"])
  subDropdownOptions?: string; // Options for the subdropdown
  subDropdownLabel?: string;   // Label for the subdropdown
  // Advanced form fields for hierarchical dropdowns
  nestedDropdowns?: boolean;  // Whether this dropdown has nested options
  nestedDropdownMap?: {[key: string]: string}; // Map of primary values to comma-separated secondary options
  // Custom labels for each level
  level2Label?: string; // Custom label for level 2 (e.g., "Category")
  level3Label?: string; // Custom label for level 3 (e.g., "Subcategory")
  level4Label?: string; // Custom label for level 4 (e.g., "Type")
  // Hide lower levels when NA or nothing is selected
  hideOnNA?: boolean;
  // Third level dropdown config
  hasThirdLevel?: boolean;
  thirdLevelMap?: {[key: string]: {[key: string]: string}}; // Map of L1->L2->L3 options
  // Fourth level dropdown config
  hasFourthLevel?: boolean;
  fourthLevelMap?: {[key: string]: {[key: string]: {[key: string]: string}}}; // Map of L1->L2->L3->L4 options
  // For repeatable interaction sections
  isRepeatable?: boolean; // Whether this question is part of a repeatable block
  repeatableGroup?: string; // ID for the repeatable group this question belongs to
  // For section-level conditional visibility
  controlsSection?: boolean; // Whether this question controls the visibility of a section
  visibleOnValues?: string[]; // Section will be visible when this question has these values
  controlledSectionId?: string; // ID of the section that this question controls
  // For intra-section (question-level) conditional visibility
  controlsVisibility?: boolean; // Whether this question controls the visibility of other questions
  controlledBy?: string | null; // ID of the question that controls this question's visibility
}

interface Section {
  id: string;
  name: string;
  type?: 'agent' | 'questionnaire' | 'custom' | 'interaction';  // Section A = agent, Section B-H = questionnaire or custom
  questions: Question[];
  isRepeatable?: boolean; // Whether this section can be repeated (for interaction tracking)
  repeatableGroupId?: string; // ID for grouping repeatable sections
  maxRepetitions?: number; // Maximum number of repetitions allowed
  repetitionIndex?: number; // Index in the repetition sequence
  isVisible?: boolean; // Whether this section is visible in the form (for conditional visibility)
  controlledBy?: string; // ID of the question that controls this section's visibility
}

interface AuditForm {
  id: string;
  name: string;
  sections: Section[];
  createdAt: string;
  createdBy: string;
  lastModified?: string;
  lastModifiedBy?: string;
}

export default function Forms() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("editor");
  const [formName, setFormName] = useState("New Audit Form");
  const [currentFormId, setCurrentFormId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [showNewSectionInput, setShowNewSectionInput] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  // Form fields
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<"text" | "dropdown" | "multiSelect" | "number" | "date" | "partner">("dropdown");
  const [questionOptions, setQuestionOptions] = useState("Yes,No,NA");
  const [questionWeightage, setQuestionWeightage] = useState(0); // Changed default from 5 to 0
  const [isMandatory, setIsMandatory] = useState(true);
  const [isFatal, setIsFatal] = useState(false);
  const [enableRemarks, setEnableRemarks] = useState(true);
  const [grazingLogic, setGrazingLogic] = useState(false);
  const [grazingPercentage, setGrazingPercentage] = useState(50);
  
  // Conditional sub-dropdown fields
  const [enableSubDropdown, setEnableSubDropdown] = useState(true);
  const [subDropdownTriggers, setSubDropdownTriggers] = useState<string[]>(["No", "Fatal"]);
  const [subDropdownLabel, setSubDropdownLabel] = useState("Reason");
  const [subDropdownOptions, setSubDropdownOptions] = useState("Technical issue,Process gap,Agent knowledge gap,Compliance gap,Other");
  
  // Advanced form fields for hierarchical dropdowns
  const [enableHierarchical, setEnableHierarchical] = useState(false);
  const [nestedDropdowns, setNestedDropdowns] = useState(false);
  const [nestedDropdownMap, setNestedDropdownMap] = useState<{[key: string]: string}>({});
  
  // Custom labels for hierarchical dropdowns
  const [level2Label, setLevel2Label] = useState("Category");
  const [level3Label, setLevel3Label] = useState("Subcategory");
  const [level4Label, setLevel4Label] = useState("Type");
  
  // Visibility options for NA/not chosen
  const [hideOnNA, setHideOnNA] = useState(true);
  
  // Third level dropdown config
  const [hasThirdLevel, setHasThirdLevel] = useState(false);
  const [thirdLevelMap, setThirdLevelMap] = useState<{[key: string]: {[key: string]: string}}>({});
  
  // Fourth level dropdown config
  const [hasFourthLevel, setHasFourthLevel] = useState(false);
  const [fourthLevelMap, setFourthLevelMap] = useState<{[key: string]: {[key: string]: {[key: string]: string}}}>({});

  // File upload state for hierarchical dropdowns
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [detectedLevel, setDetectedLevel] = useState<number | null>(null);
  
  // Repeatable section fields
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [repeatableGroupId, setRepeatableGroupId] = useState<string>("");
  
  // Conditional section visibility fields
  const [controlsSection, setControlsSection] = useState(false);
  const [visibleOnValues, setVisibleOnValues] = useState<string[]>(["Yes"]);
  const [controlledSectionId, setControlledSectionId] = useState<string>("");
  
  // Conditional question visibility fields (within a section)
  const [controlsVisibility, setControlsVisibility] = useState(false);
  const [controlledBy, setControlledBy] = useState<string | null>(null);
  
  // State for saved forms
  const [savedForms, setSavedForms] = useState<AuditForm[]>([]);
  
  // State for current form sections and questions
  const [formSections, setFormSections] = useState<Section[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  
  // State for editing questions
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Check for existing forms on component mount and refresh periodically
  useEffect(() => {
    loadSavedForms();
    
    // Initialize with one empty section if no form is being edited
    if (formSections.length === 0) {
      const initialSection: Section = {
        id: generateId('section'),
        name: "Section A",
        type: 'agent',
        questions: []
      };
      setFormSections([initialSection]);
      setCurrentSectionId(initialSection.id);
    }
    
    // Set up automatic form list refresh every 10 seconds
    const refreshInterval = setInterval(() => {
      loadSavedForms();
    }, 10000);
    
    // Set up a recurring interval to continuously check for and remove problematic reports
    // This ensures they can't reappear if other parts of the app are recreating them
    const purgeInterval = setInterval(() => {
      purgeProblematicReports();
    }, 5000); // Check every 5 seconds
    
    // Clean up the intervals when the component unmounts
    return () => {
      clearInterval(refreshInterval);
      clearInterval(purgeInterval);
    };
  }, []);

  // Add refresh mechanism for tab changes
  useEffect(() => {
    if (activeTab === 'library') {
      loadSavedForms(); // Refresh forms when user switches to library tab
    }
  }, [activeTab]);
  
  
  // Load forms from database first, fallback to localStorage
  const loadSavedForms = async () => {
    // First, run the purge to ensure problematic reports are cleaned up
    purgeProblematicReports();
    
    try {
      // Try to load from database first
      const response = await fetch('/api/forms', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const dbForms = await response.json();
        console.log(`Loaded ${dbForms?.length || 0} forms from database`);
        setSavedForms(dbForms || []);
        return; // Successfully loaded from database
      }
      
      // Fallback to localStorage if database fails
      const forms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
      if (forms && forms.length > 0) {
        setSavedForms(forms);
      } else {
        // Initialize with default templates if no forms exist
        // Use a different name for the default form to avoid issues with problematic form names
        const defaultForms: AuditForm[] = [
          {
            id: generateId('form'),
            name: "Standard Quality Assessment", // Changed from "Call Quality Assessment"
            sections: [
              {
                id: generateId('section'),
                name: "Section A",
                type: 'agent',
                questions: [
                  {
                    id: generateId('question'),
                    text: "Did the agent greet the customer properly?",
                    type: "dropdown",
                    options: "Yes,No",
                    weightage: 0, // No weight for agent section
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false
                  },
                  {
                    id: generateId('question'),
                    text: "Did the agent identify themselves by name?",
                    type: "dropdown",
                    options: "Yes,No",
                    weightage: 0, // No weight for agent section
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false
                  }
                ]
              },
              {
                id: generateId('section'),
                name: "Section B",
                type: 'questionnaire',
                questions: [
                  {
                    id: generateId('question'),
                    text: "Did the agent verify the customer's identity?",
                    type: "dropdown",
                    options: "Yes,No",
                    weightage: 7,
                    mandatory: true,
                    isFatal: true,
                    enableRemarks: true,
                    grazingLogic: false
                  }
                ]
              }
            ],
            createdAt: new Date().toISOString(),
            createdBy: "System"
          },
          {
            id: generateId('form'),
            name: "Nested Conditional Logic Form",
            sections: [
              {
                id: generateId('section'),
                name: "Section A - Agent Information",
                type: 'agent',
                questions: [
                  {
                    id: generateId('question'),
                    text: "Agent Name",
                    type: "text",
                    options: "",
                    weightage: 0,
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: false,
                    grazingLogic: false
                  },
                  {
                    id: generateId('question'),
                    text: "Do you want to fill out the product feedback section?",
                    type: "dropdown",
                    options: "Yes,NA",
                    weightage: 0,
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false,
                    controlsSection: true,
                    visibleOnValues: ["Yes"],
                    controlledSectionId: "product_feedback_section"
                  }
                ]
              },
              {
                id: "product_feedback_section",
                name: "Product Feedback Section",
                type: 'questionnaire',
                controlledBy: "section_a_control_question",
                questions: [
                  {
                    id: "damage_question",
                    text: "Was the product received damaged?",
                    type: "dropdown",
                    options: "Yes,No",
                    weightage: 5,
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false,
                    controlsVisibility: true
                  },
                  {
                    id: generateId('question'),
                    text: "Describe the damage",
                    type: "text",
                    options: "",
                    weightage: 3,
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false,
                    controlledBy: "damage_question",
                    visibleOnValues: ["Yes"]
                  },
                  {
                    id: generateId('question'),
                    text: "Upload relevant evidence",
                    type: "text",
                    options: "",
                    weightage: 2,
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false,
                    controlledBy: "damage_question",
                    visibleOnValues: ["Yes"]
                  },
                  {
                    id: generateId('question'),
                    text: "Overall product satisfaction",
                    type: "dropdown",
                    options: "Excellent,Good,Average,Poor",
                    weightage: 4,
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false
                  }
                ]
              },
              {
                id: generateId('section'),
                name: "Section C - General Questions",
                type: 'questionnaire',
                questions: [
                  {
                    id: generateId('question'),
                    text: "Would you recommend this service?",
                    type: "dropdown",
                    options: "Yes,No,Maybe",
                    weightage: 5,
                    mandatory: true,
                    isFatal: false,
                    enableRemarks: true,
                    grazingLogic: false
                  }
                ]
              }
            ],
            createdAt: new Date().toISOString(),
            createdBy: "System"
          }
        ];
        
        setSavedForms(defaultForms);
        localStorage.setItem('qa-audit-forms', JSON.stringify(defaultForms));
      }
    } catch (error) {
      console.error("Error loading audit forms:", error);
      // Fallback to localStorage on error
      try {
        const forms = JSON.parse(localStorage.getItem('qa-audit-forms') || '[]');
        if (forms && forms.length > 0) {
          setSavedForms(forms);
        }
      } catch (localError) {
        console.error("Error loading from localStorage:", localError);
      }
    }
  };
  
  // Get current section questions
  const getCurrentSectionQuestions = (): Question[] => {
    if (!currentSectionId) return [];
    const section = formSections.find(s => s.id === currentSectionId);
    return section?.questions || [];
  };

  // Set current section
  const setCurrentSection = (sectionId: string) => {
    setCurrentSectionId(sectionId);
    const section = formSections.find(s => s.id === sectionId);
    if (section) {
      setNewSectionName(section.name);
    }
  };

  // Add a new section to the form
  const addSection = () => {
    if (showNewSectionInput) {
      if (!newSectionName.trim()) {
        alert("Please enter a section name");
        return;
      }
      
      const newSection: Section = {
        id: generateId('section'),
        name: newSectionName,
        type: 'custom',
        questions: []
      };
      
      setFormSections([...formSections, newSection]);
      setCurrentSectionId(newSection.id);
      setShowNewSectionInput(false);
      setNewSectionName("");
    } else {
      setShowNewSectionInput(true);
    }
  };
  
  // Reset to template selection screen
  const resetToTemplateSelection = () => {
    if (window.confirm("Are you sure you want to start over? Any unsaved changes will be lost.")) {
      setShowTemplateSelector(true);
      setSelectedTemplate(null);
      setFormName("New Audit Form");
      setCurrentFormId(null);
      setFormSections([]);
      setCurrentSectionId(null);
    }
  };

  // Excel file parsing utility for hierarchical dropdowns
  const parseFileData = (data: any[][]): { level: number; parsedData: any } => {
    if (!data || data.length === 0) {
      throw new Error('No data found in file');
    }

    // Filter out empty rows
    let validRows = data.filter(row => row.some(cell => cell && cell.toString().trim()));
    if (validRows.length === 0) {
      throw new Error('No valid data rows found');
    }

    // Detect and skip header row if present
    const firstRow = validRows[0];
    const isHeaderRow = firstRow.some(cell => {
      const cellStr = cell?.toString().toLowerCase().trim();
      return cellStr && (
        cellStr.includes('level') || 
        cellStr.includes('category') || 
        cellStr.includes('subcategory') ||
        cellStr.includes('type') ||
        cellStr === 'l1' || cellStr === 'l2' || cellStr === 'l3' || cellStr === 'l4'
      );
    });

    if (isHeaderRow && validRows.length > 1) {
      validRows = validRows.slice(1); // Skip header row
    }

    if (validRows.length === 0) {
      throw new Error('No data rows found after header detection');
    }

    const dataRow = validRows[0];
    const columnCount = dataRow.filter(cell => cell && cell.toString().trim()).length;

    if (columnCount < 1 || columnCount > 4) {
      throw new Error('File must have 1-4 columns (Level 1 only, or Level 1 → Level 2/3/4)');
    }

    const level = columnCount;
    const parsedData: any = {};

    // Helper function to deduplicate comma-separated values
    const deduplicateOptions = (optionsString: string): string => {
      const options = optionsString.split(',').map(opt => opt.trim()).filter(opt => opt);
      return Array.from(new Set(options)).join(',');
    };

    if (level === 1) {
      // Level 1 only: Just a list of options for the first dropdown
      const level1Options: string[] = [];
      validRows.forEach(row => {
        const l1 = row[0]?.toString().trim();
        if (l1) {
          level1Options.push(l1);
        }
      });
      // Deduplicate Level 1 options
      const uniqueOptions = Array.from(new Set(level1Options));
      parsedData.level1Options = uniqueOptions.join(',');
    } else if (level === 2) {
      // Level 2: L1 → L2
      const nestedMap: {[key: string]: string} = {};
      validRows.forEach(row => {
        const l1 = row[0]?.toString().trim();
        const l2 = row[1]?.toString().trim();
        if (l1 && l2) {
          if (nestedMap[l1]) {
            nestedMap[l1] += `,${l2}`;
          } else {
            nestedMap[l1] = l2;
          }
        }
      });
      // Deduplicate all L2 options for each L1
      Object.keys(nestedMap).forEach(l1 => {
        nestedMap[l1] = deduplicateOptions(nestedMap[l1]);
      });
      parsedData.nestedDropdownMap = nestedMap;
    } else if (level === 3) {
      // Level 3: L1 → L2 → L3
      const nestedMap: {[key: string]: string} = {};
      const thirdMap: {[key: string]: {[key: string]: string}} = {};
      
      validRows.forEach(row => {
        const l1 = row[0]?.toString().trim();
        const l2 = row[1]?.toString().trim();
        const l3 = row[2]?.toString().trim();
        
        if (l1 && l2 && l3) {
          // Build L1 → L2 mapping
          if (nestedMap[l1]) {
            nestedMap[l1] += `,${l2}`;
          } else {
            nestedMap[l1] = l2;
          }
          
          // Build L1 → L2 → L3 mapping
          if (!thirdMap[l1]) thirdMap[l1] = {};
          if (thirdMap[l1][l2]) {
            thirdMap[l1][l2] += `,${l3}`;
          } else {
            thirdMap[l1][l2] = l3;
          }
        }
      });
      
      // Deduplicate all options
      Object.keys(nestedMap).forEach(l1 => {
        nestedMap[l1] = deduplicateOptions(nestedMap[l1]);
      });
      Object.keys(thirdMap).forEach(l1 => {
        Object.keys(thirdMap[l1]).forEach(l2 => {
          thirdMap[l1][l2] = deduplicateOptions(thirdMap[l1][l2]);
        });
      });
      
      parsedData.nestedDropdownMap = nestedMap;
      parsedData.thirdLevelMap = thirdMap;
    } else if (level === 4) {
      // Level 4: L1 → L2 → L3 → L4
      const nestedMap: {[key: string]: string} = {};
      const thirdMap: {[key: string]: {[key: string]: string}} = {};
      const fourthMap: {[key: string]: {[key: string]: {[key: string]: string}}} = {};
      
      validRows.forEach(row => {
        const l1 = row[0]?.toString().trim();
        const l2 = row[1]?.toString().trim();
        const l3 = row[2]?.toString().trim();
        const l4 = row[3]?.toString().trim();
        
        if (l1 && l2 && l3 && l4) {
          // Build L1 → L2 mapping
          if (nestedMap[l1]) {
            nestedMap[l1] += `,${l2}`;
          } else {
            nestedMap[l1] = l2;
          }
          
          // Build L1 → L2 → L3 mapping
          if (!thirdMap[l1]) thirdMap[l1] = {};
          if (thirdMap[l1][l2]) {
            thirdMap[l1][l2] += `,${l3}`;
          } else {
            thirdMap[l1][l2] = l3;
          }
          
          // Build L1 → L2 → L3 → L4 mapping
          if (!fourthMap[l1]) fourthMap[l1] = {};
          if (!fourthMap[l1][l2]) fourthMap[l1][l2] = {};
          if (fourthMap[l1][l2][l3]) {
            fourthMap[l1][l2][l3] += `,${l4}`;
          } else {
            fourthMap[l1][l2][l3] = l4;
          }
        }
      });
      
      // Deduplicate all options
      Object.keys(nestedMap).forEach(l1 => {
        nestedMap[l1] = deduplicateOptions(nestedMap[l1]);
      });
      Object.keys(thirdMap).forEach(l1 => {
        Object.keys(thirdMap[l1]).forEach(l2 => {
          thirdMap[l1][l2] = deduplicateOptions(thirdMap[l1][l2]);
        });
      });
      Object.keys(fourthMap).forEach(l1 => {
        Object.keys(fourthMap[l1]).forEach(l2 => {
          Object.keys(fourthMap[l1][l2]).forEach(l3 => {
            fourthMap[l1][l2][l3] = deduplicateOptions(fourthMap[l1][l2][l3]);
          });
        });
      });
      
      parsedData.nestedDropdownMap = nestedMap;
      parsedData.thirdLevelMap = thirdMap;
      parsedData.fourthLevelMap = fourthMap;
    }

    return { level, parsedData };
  };

  // Handle Excel file upload for hierarchical dropdowns
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    setUploadMessage('Reading file...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        setUploadMessage('Parsing data...');
        const { level, parsedData } = parseFileData(jsonData as any[][]);
        
        setDetectedLevel(level);
        setPreviewData(jsonData.slice(0, 5) as any[]); // Show first 5 rows as preview

        // Apply the parsed data to the form
        if (level === 1) {
          setQuestionOptions(parsedData.level1Options);
          setNestedDropdowns(false);
          setHasThirdLevel(false);
          setHasFourthLevel(false);
          setUploadMessage(`✓ Loaded ${parsedData.level1Options.split(',').length} Level 1 options`);
        } else if (level === 2) {
          const level1Options = Object.keys(parsedData.nestedDropdownMap).join(',');
          setQuestionOptions(level1Options);
          setNestedDropdownMap(parsedData.nestedDropdownMap);
          setNestedDropdowns(true);
          setHasThirdLevel(false);
          setHasFourthLevel(false);
          setUploadMessage(`✓ Loaded ${level1Options.split(',').length} Level 1 options with Level 2 mappings`);
        } else if (level === 3) {
          const level1Options = Object.keys(parsedData.nestedDropdownMap).join(',');
          setQuestionOptions(level1Options);
          setNestedDropdownMap(parsedData.nestedDropdownMap);
          setThirdLevelMap(parsedData.thirdLevelMap);
          setNestedDropdowns(true);
          setHasThirdLevel(true);
          setHasFourthLevel(false);
          setUploadMessage(`✓ Loaded 3-level hierarchy with ${level1Options.split(',').length} Level 1 options`);
        } else if (level === 4) {
          const level1Options = Object.keys(parsedData.nestedDropdownMap).join(',');
          setQuestionOptions(level1Options);
          setNestedDropdownMap(parsedData.nestedDropdownMap);
          setThirdLevelMap(parsedData.thirdLevelMap);
          setFourthLevelMap(parsedData.fourthLevelMap);
          setNestedDropdowns(true);
          setHasThirdLevel(true);
          setHasFourthLevel(true);
          setUploadMessage(`✓ Loaded 4-level hierarchy with ${level1Options.split(',').length} Level 1 options`);
        }

        setUploadStatus('success');
        setTimeout(() => {
          setUploadStatus('idle');
        }, 3000);
      } catch (error: any) {
        setUploadStatus('error');
        setUploadMessage(`Error: ${error.message}`);
        console.error('File upload error:', error);
      }
    };

    reader.onerror = () => {
      setUploadStatus('error');
      setUploadMessage('Error reading file');
    };

    reader.readAsBinaryString(file);
  };

  // Add a question to the current section
  const addQuestion = () => {
    if (!currentSectionId) {
      alert("Please select a section first");
      return;
    }
    
    if (!questionText.trim()) {
      alert("Please enter a question text");
      return;
    }
    
    // Check if current section is an agent section (Section A)
    const currentSection = formSections.find(s => s.id === currentSectionId);
    const isAgentSection = currentSection?.type === 'agent';
    
    // Use checkbox value for enableRemarks regardless of section type
    const shouldEnableRemarks = enableRemarks;
    
    const newQuestion: Question = {
      id: generateId('question'),
      text: questionText,
      type: questionType,
      options: (questionType === 'dropdown' || questionType === 'multiSelect') && questionType !== 'partner' ? questionOptions : undefined,
      // For agent sections or partner questions, set weightage to 0 (no marks)
      weightage: isAgentSection || questionType === 'partner' ? 0 : questionWeightage,
      mandatory: isMandatory,
      // No fatal errors for agent sections
      isFatal: isAgentSection ? false : isFatal,
      // For agent sections, always force remarks to be enabled
      enableRemarks: shouldEnableRemarks,
      // No grazing logic for agent sections
      grazingLogic: isAgentSection ? false : grazingLogic,
      grazingPercentage: (isAgentSection ? false : grazingLogic) ? grazingPercentage : undefined,
      // Conditional sub-dropdown settings (only for dropdown questions)
      ...(questionType === 'dropdown' && enableSubDropdown && {
        showSubDropdownOn: subDropdownTriggers,
        subDropdownLabel: subDropdownLabel,
        subDropdownOptions: subDropdownOptions
      }),
      // Hierarchical dropdown settings 
      ...(questionType === 'dropdown' && enableHierarchical && {
        nestedDropdowns: true,
        nestedDropdownMap: Object.keys(nestedDropdownMap).length > 0 ? nestedDropdownMap : undefined,
        // Custom labels
        level2Label: level2Label || undefined,
        level3Label: level3Label || undefined,
        level4Label: level4Label || undefined,
        // Hide on NA or not chosen setting
        hideOnNA: hideOnNA,
        // Third level
        hasThirdLevel: hasThirdLevel,
        thirdLevelMap: hasThirdLevel && Object.keys(thirdLevelMap).length > 0 ? thirdLevelMap : undefined,
        // Fourth level
        hasFourthLevel: hasFourthLevel,
        fourthLevelMap: hasFourthLevel && Object.keys(fourthLevelMap).length > 0 ? fourthLevelMap : undefined
      }),
      // Repeatable section fields
      isRepeatable: isRepeatable,
      repeatableGroup: isRepeatable ? repeatableGroupId : undefined,
      // Conditional section visibility fields (only for advanced form template)
      ...(questionType === 'dropdown' && selectedTemplate === 'advanced' && isAgentSection && controlsSection && {
        controlsSection: true,
        visibleOnValues: visibleOnValues,
        controlledSectionId: controlledSectionId
      }),
      // Conditional question visibility fields within a section
      ...(questionType === 'dropdown' && controlsVisibility && {
        controlsVisibility: true,
        visibleOnValues: visibleOnValues
      }),
      // If this question is controlled by another question in the section
      ...(controlledBy && {
        controlledBy: controlledBy
      })
    };
    
    const updatedSections = formSections.map(section => {
      if (section.id === currentSectionId) {
        return {
          ...section,
          questions: [...section.questions, newQuestion]
        };
      }
      return section;
    });
    
    setFormSections(updatedSections);
    
    // Reset form fields
    setQuestionText("");
    setQuestionType("dropdown");
    setQuestionOptions("Yes,No,NA");
    setQuestionWeightage(0); // Changed default from 5 to 0
    setIsMandatory(true);
    setIsFatal(false);
    setEnableRemarks(true);
    setGrazingLogic(false);
    setGrazingPercentage(50);
    // Reset sub-dropdown fields
    setEnableSubDropdown(false);
    setSubDropdownLabel("Reason");
    setSubDropdownOptions("");
    setSubDropdownTriggers([]);
    // Reset hierarchical dropdown fields
    setEnableHierarchical(false);
    setNestedDropdowns(false);
    setNestedDropdownMap({});
    setLevel2Label("Category");
    setLevel3Label("Subcategory");
    setLevel4Label("Type");
    setHasThirdLevel(false);
    setHideOnNA(true); // Reset hide on NA setting
    setThirdLevelMap({});
    setHasFourthLevel(false);
    setFourthLevelMap({});
    // Reset repeatable fields
    setIsRepeatable(false);
    setRepeatableGroupId("");
  };

  // Edit a question
  const startEditingQuestion = (sectionId: string, questionId: string) => {
    if (!sectionId || !questionId) {
      console.log("Missing sectionId or questionId", { sectionId, questionId });
      return;
    }
    
    const section = formSections.find(s => s.id === sectionId);
    if (!section) {
      console.log("Section not found", { sectionId, formSections });
      return;
    }
    
    const question = section.questions.find(q => q.id === questionId);
    if (!question) {
      console.log("Question not found", { questionId, sectionQuestions: section.questions });
      return;
    }
    
    console.log("Editing question:", question);
    
    // Set form fields to question values
    setQuestionText(question.text);
    setQuestionType(question.type);
    if (question.options) setQuestionOptions(question.options);
    setQuestionWeightage(question.weightage);
    setIsMandatory(question.mandatory);
    setIsFatal(question.isFatal);
    setEnableRemarks(question.enableRemarks);
    setGrazingLogic(question.grazingLogic);
    if (question.grazingPercentage) setGrazingPercentage(question.grazingPercentage);
    
    // Set sub-dropdown fields if they exist
    setEnableSubDropdown(!!question.showSubDropdownOn);
    if (question.showSubDropdownOn) setSubDropdownTriggers(question.showSubDropdownOn);
    if (question.subDropdownLabel) setSubDropdownLabel(question.subDropdownLabel);
    if (question.subDropdownOptions) setSubDropdownOptions(question.subDropdownOptions);
    
    // Set hierarchical dropdown fields if they exist
    setEnableHierarchical(!!question.nestedDropdowns);
    setNestedDropdowns(!!question.nestedDropdowns);
    if (question.nestedDropdownMap) setNestedDropdownMap(question.nestedDropdownMap);
    
    // Custom labels
    if (question.level2Label) setLevel2Label(question.level2Label);
    if (question.level3Label) setLevel3Label(question.level3Label);
    if (question.level4Label) setLevel4Label(question.level4Label);
    
    // Third level configuration
    setHasThirdLevel(!!question.hasThirdLevel);
    if (question.thirdLevelMap) setThirdLevelMap(question.thirdLevelMap);
    
    // Fourth level configuration
    setHasFourthLevel(!!question.hasFourthLevel);
    if (question.fourthLevelMap) setFourthLevelMap(question.fourthLevelMap);
    
    // Set repeatable section fields if they exist
    setIsRepeatable(!!question.isRepeatable);
    if (question.repeatableGroup) setRepeatableGroupId(question.repeatableGroup);
    
    // Set conditional section visibility fields if they exist
    setControlsSection(!!question.controlsSection);
    if (question.visibleOnValues) setVisibleOnValues(question.visibleOnValues);
    if (question.controlledSectionId) setControlledSectionId(question.controlledSectionId);
    
    // Set conditional question visibility fields if they exist
    setControlsVisibility(!!question.controlsVisibility);
    // controlledBy is set above with visibleOnValues
    setControlledBy(question.controlledBy || null);
    
    // Set editing state
    setEditingQuestionId(questionId);
    setIsEditing(true);
    
    console.log("Edit state set", { editingQuestionId: questionId, isEditing: true });
  };
  
  // Update an existing question
  const updateQuestion = () => {
    console.log("Update question called", { currentSectionId, editingQuestionId });
    
    if (!currentSectionId || !editingQuestionId) {
      alert("No question selected for editing");
      return;
    }
    
    if (!questionText.trim()) {
      alert("Please enter a question text");
      return;
    }
    
    // Check if current section is an agent section (Section A)
    const currentSection = formSections.find(s => s.id === currentSectionId);
    const isAgentSection = currentSection?.type === 'agent';
    
    console.log("Current section:", { currentSection, isAgentSection });
    
    // Use checkbox value for enableRemarks regardless of section type
    const shouldEnableRemarks = enableRemarks;
    
    const updatedSections = formSections.map(section => {
      if (section.id === currentSectionId) {
        const updatedQuestions = section.questions.map(q => {
          if (q.id === editingQuestionId) {
            console.log("Updating question", { 
              old: q,
              newValues: {
                text: questionText,
                type: questionType,
                options: questionType === 'dropdown' || questionType === 'multiSelect' ? questionOptions : undefined,
                weightage: isAgentSection ? 0 : questionWeightage,
                mandatory: isMandatory,
                isFatal: isAgentSection ? false : isFatal,
                enableRemarks: shouldEnableRemarks,
                grazingLogic: isAgentSection ? false : grazingLogic,
                grazingPercentage: (isAgentSection ? false : grazingLogic) ? grazingPercentage : undefined
              }
            });
            
            return {
              ...q,
              text: questionText,
              type: questionType,
              options: questionType === 'dropdown' || questionType === 'multiSelect' ? questionOptions : undefined,
              weightage: isAgentSection ? 0 : questionWeightage,
              mandatory: isMandatory,
              isFatal: isAgentSection ? false : isFatal,
              enableRemarks: shouldEnableRemarks,
              grazingLogic: isAgentSection ? false : grazingLogic,
              grazingPercentage: (isAgentSection ? false : grazingLogic) ? grazingPercentage : undefined,
              // Conditional sub-dropdown settings (only for dropdown questions)
              ...(questionType === 'dropdown' && enableSubDropdown && {
                showSubDropdownOn: subDropdownTriggers,
                subDropdownLabel: subDropdownLabel,
                subDropdownOptions: subDropdownOptions
              }),
              // If the question type is not dropdown or enableSubDropdown is false,
              // remove any existing sub-dropdown settings
              ...(!enableSubDropdown || questionType !== 'dropdown' ? {
                showSubDropdownOn: undefined,
                subDropdownLabel: undefined,
                subDropdownOptions: undefined
              } : {}),
              // Hierarchical dropdown settings
              ...(questionType === 'dropdown' && enableHierarchical && {
                nestedDropdowns: true,
                nestedDropdownMap: Object.keys(nestedDropdownMap).length > 0 ? nestedDropdownMap : undefined,
                // Custom labels
                level2Label: level2Label || undefined,
                level3Label: level3Label || undefined,
                level4Label: level4Label || undefined,
                // Hide on NA or not chosen setting
                hideOnNA: hideOnNA,
                // Third level
                hasThirdLevel: hasThirdLevel,
                thirdLevelMap: hasThirdLevel && Object.keys(thirdLevelMap).length > 0 ? thirdLevelMap : undefined,
                // Fourth level
                hasFourthLevel: hasFourthLevel,
                fourthLevelMap: hasFourthLevel && Object.keys(fourthLevelMap).length > 0 ? fourthLevelMap : undefined
              }),
              // If the question type is not dropdown or enableHierarchical is false,
              // remove any existing hierarchical dropdown settings
              ...(!enableHierarchical || questionType !== 'dropdown' ? {
                nestedDropdowns: undefined,
                nestedDropdownMap: undefined,
                level2Label: undefined,
                level3Label: undefined,
                level4Label: undefined,
                hasThirdLevel: undefined,
                thirdLevelMap: undefined,
                hasFourthLevel: undefined,
                fourthLevelMap: undefined
              } : {}),
              // Repeatable section fields
              isRepeatable,
              repeatableGroup: isRepeatable ? repeatableGroupId : undefined,
              // Conditional section visibility fields
              ...(questionType === 'dropdown' && controlsSection && {
                controlsSection: true,
                visibleOnValues: visibleOnValues.length > 0 ? visibleOnValues : undefined,
                controlledSectionId: controlledSectionId || undefined
              }),
              // If controlsSection is false, remove any existing conditional section visibility settings
              ...(!controlsSection || questionType !== 'dropdown' ? {
                controlsSection: undefined,
                visibleOnValues: undefined,
                controlledSectionId: undefined
              } : {}),
              // Conditional question visibility fields
              ...(questionType === 'dropdown' && controlsVisibility && {
                controlsVisibility: true,
                visibleOnValues: visibleOnValues.length > 0 ? visibleOnValues : undefined
              }),
              // If controlsVisibility is false, remove any existing conditional question visibility settings
              ...(!controlsVisibility || questionType !== 'dropdown' ? {
                controlsVisibility: undefined
              } : {}),
              // Question that's controlled by another question
              controlledBy: controlledBy
            };
          }
          return q;
        });
        
        return {
          ...section,
          questions: updatedQuestions
        };
      }
      return section;
    });
    
    console.log("Updated sections:", updatedSections);
    setFormSections(updatedSections);
    
    // Reset form fields and editing state
    setQuestionText("");
    setQuestionType("dropdown");
    setQuestionOptions("Yes,No,NA");
    setQuestionWeightage(0); // Changed default from 5 to 0
    setIsMandatory(true);
    setIsFatal(false);
    setEnableRemarks(true);
    setGrazingLogic(false);
    setGrazingPercentage(50);
    // Reset sub-dropdown fields
    setEnableSubDropdown(false);
    setSubDropdownLabel("Reason");
    setSubDropdownOptions("");
    setSubDropdownTriggers([]);
    // Reset hierarchical dropdown fields
    setEnableHierarchical(false);
    setNestedDropdowns(false);
    setNestedDropdownMap({});
    setLevel2Label("Category");
    setLevel3Label("Subcategory");
    setLevel4Label("Type");
    setHideOnNA(true); // Reset hide on NA setting
    setHasThirdLevel(false);
    setThirdLevelMap({});
    setHasFourthLevel(false);
    setFourthLevelMap({});
    // Reset repeatable fields
    setIsRepeatable(false);
    setRepeatableGroupId("");
    // Reset conditional visibility fields
    setControlsVisibility(false);
    setControlsSection(false);
    setVisibleOnValues(["Yes"]);
    setControlledSectionId("");
    // Reset editing state
    setEditingQuestionId(null);
    setIsEditing(false);
    
    console.log("Edit state reset", { editingQuestionId: null, isEditing: false });
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setQuestionText("");
    setQuestionType("dropdown");
    setQuestionOptions("Yes,No,NA");
    setQuestionWeightage(0); // Changed default from 5 to 0
    setIsMandatory(true);
    setIsFatal(false);
    setEnableRemarks(true);
    setGrazingLogic(false);
    setGrazingPercentage(50);
    // Reset sub-dropdown fields
    setEnableSubDropdown(false);
    setSubDropdownLabel("Reason");
    setSubDropdownOptions("");
    setSubDropdownTriggers([]);
    // Reset hierarchical dropdown fields
    setEnableHierarchical(false);
    setNestedDropdowns(false);
    setNestedDropdownMap({});
    setLevel2Label("Category");
    setLevel3Label("Subcategory");
    setHideOnNA(true); // Reset hide on NA setting
    setLevel4Label("Type");
    setHasThirdLevel(false);
    setThirdLevelMap({});
    setHasFourthLevel(false);
    setFourthLevelMap({});
    // Reset repeatable fields
    setIsRepeatable(false);
    setRepeatableGroupId("");
    // Reset conditional section visibility fields
    setControlsSection(false);
    setVisibleOnValues(["Yes"]);
    setControlledSectionId("");
    // Reset editing state
    setEditingQuestionId(null);
    setIsEditing(false);
  };
  
  // Remove a question from a section
  const removeQuestion = (sectionId: string, questionId: string) => {
    const updatedSections = formSections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          questions: section.questions.filter(q => q.id !== questionId)
        };
      }
      return section;
    });
    
    setFormSections(updatedSections);
    
    // If currently editing this question, cancel editing
    if (editingQuestionId === questionId) {
      cancelEditing();
    }
  };
  
  // Duplicate a question within a section
  const duplicateQuestion = (sectionId: string, questionId: string) => {
    const updatedSections = formSections.map(section => {
      if (section.id === sectionId) {
        // Find the question to duplicate
        const questionToDuplicate = section.questions.find(q => q.id === questionId);
        
        if (questionToDuplicate) {
          // Create a deep copy of the question with a new ID
          const duplicatedQuestion = {
            ...JSON.parse(JSON.stringify(questionToDuplicate)),
            id: generateId('question'),
            text: `${questionToDuplicate.text} (Copy)`
          };
          
          // Insert the duplicated question right after the original
          const originalIndex = section.questions.findIndex(q => q.id === questionId);
          const newQuestions = [...section.questions];
          newQuestions.splice(originalIndex + 1, 0, duplicatedQuestion);
          
          return {
            ...section,
            questions: newQuestions
          };
        }
      }
      return section;
    });

    setFormSections(updatedSections);
  };

  // Save the current form to database
  const saveForm = async () => {
    if (!formName.trim()) {
      alert("Please enter a form name");
      return;
    }
    
    // Don't allow creating forms with problematic names
    const problematicFormNames = ['Call Quality Assessment'];
    if (problematicFormNames.includes(formName.trim())) {
      alert("This form name has been blacklisted due to known issues. Please use a different name.");
      return;
    }
    
    // Check if any section has no questions
    const emptySections = formSections.filter(section => section.questions.length === 0);
    if (emptySections.length > 0) {
      const confirm = window.confirm(`${emptySections.length} section(s) have no questions. Do you want to save anyway?`);
      if (!confirm) return;
    }
    
    try {
      // Create form data for API
      const formData = {
        name: formName,
        sections: formSections, // Send sections directly as expected by database schema
        createdBy: user?.username || 'admin'
      };
      
      let response;
      if (currentFormId && !String(currentFormId).startsWith('form_')) {
        // Update existing form in database
        response = await fetch(`/api/forms/${currentFormId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(formData)
        });
      } else {
        // Create new form in database
        response = await fetch('/api/forms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(formData)
        });
      }
      
      if (response.ok) {
        const savedForm = await response.json();
        
        // Update local state with the saved form
        setCurrentFormId(savedForm.id.toString());
        
        // Refresh the forms list from database
        await loadSavedForms();
        
        // Dispatch event to notify other components that the form has been updated
        console.log(`Dispatching form update event for "${formName}"`);
        dispatchFormUpdate(formName);
        
        alert(`Form "${formName}" saved successfully to database!`);
        
        // Force immediate refresh of the forms list
        setTimeout(() => loadSavedForms(), 500);
      } else {
        throw new Error(`Failed to save form: ${response.status}`);
      }
      
    } catch (error) {
      console.error('Error saving form to database:', error);
      
      // Fallback to localStorage save
      const timestamp = new Date().toISOString();
      const formToSave: AuditForm = currentFormId 
        ? {
            ...savedForms.find(f => f.id === currentFormId)!,
            name: formName,
            sections: formSections,
            lastModified: timestamp,
            lastModifiedBy: user?.username || 'Unknown'
          }
        : {
            id: generateId('form'),
            name: formName,
            sections: formSections,
            createdAt: timestamp,
            createdBy: user?.username || 'Unknown'
          };
      
      // Update savedForms state
      const updatedForms = currentFormId
        ? savedForms.map(form => form.id === currentFormId ? formToSave : form)
        : [...savedForms, formToSave];
      
      setSavedForms(updatedForms);
      localStorage.setItem('qa-audit-forms', JSON.stringify(updatedForms));
      
      // Dispatch event even for localStorage save
      console.log(`Dispatching form update event for localStorage-saved form "${formName}"`);
      dispatchFormUpdate(formName);
      
      setCurrentFormId(formToSave.id);
      alert(`Database save failed, but form "${formName}" saved locally. Error: ${error}`);
    }
  };

  // Load a form for editing
  const loadForm = (formId: string) => {
    const form = savedForms.find(f => f.id === formId);
    if (form) {
      setFormName(form.name);
      setFormSections(Array.isArray(form.sections) ? form.sections : form.sections?.sections || []);
      setCurrentFormId(form.id);
      setShowTemplateSelector(false);
      
      const sections = Array.isArray(form.sections) ? form.sections : form.sections?.sections || [];
      if (sections.length > 0) {
        setCurrentSectionId(sections[0].id);
      }
      
      setActiveTab("editor");
    }
  };

  // Duplicate an existing form
  const duplicateForm = async (formId: string) => {
    const form = savedForms.find(f => f.id === formId);
    if (form) {
      // Don't allow duplicating problematic forms
      const problematicFormNames = ['Call Quality Assessment'];
      if (problematicFormNames.includes(form.name.trim())) {
        alert("This form type has been blacklisted due to known issues and cannot be duplicated.");
        return;
      }
      
      try {
        // Create form data for API
        const sections = Array.isArray(form.sections) ? form.sections : form.sections?.sections || [];
        const formData = {
          name: `${form.name} (Copy)`,
          sections: { sections: sections }, // Wrap sections in object to match database structure
          createdBy: user?.id || 1
        };
        
        // Create new form in database
        const response = await fetch('/api/forms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(formData)
        });
        
        if (response.ok) {
          const duplicatedForm = await response.json();
          
          // Refresh the forms list from database
          await loadSavedForms();
          
          // Dispatch event to notify other components that a new form was added
          console.log(`Dispatching form update event for new form: ${duplicatedForm.name}`);
          dispatchFormUpdate('*');
          
          alert(`Duplicated form: ${form.name}`);
          
          // Force immediate refresh of the forms list
          setTimeout(() => loadSavedForms(), 500);
        } else {
          throw new Error(`Failed to duplicate form: ${response.status}`);
        }
        
      } catch (error) {
        console.error('Error duplicating form in database:', error);
        
        // Fallback to localStorage duplication
        const timestamp = new Date().toISOString();
        const newForm: AuditForm = {
          ...form,
          id: generateId('form'),
          name: `${form.name} (Copy)`,
          createdAt: timestamp,
          createdBy: user?.username || 'Unknown'
        };
        
        const updatedForms = [...savedForms, newForm];
        setSavedForms(updatedForms);
        localStorage.setItem('qa-audit-forms', JSON.stringify(updatedForms));
        
        // Dispatch event to notify other components that a new form was added
        console.log(`Dispatching form update event for new form: ${newForm.name}`);
        dispatchFormUpdate('*');
        
        alert(`Database duplication failed, but created local copy: ${form.name}. Error: ${error}`);
      }
    }
  };

  // Delete a form
  const deleteForm = async (formId: string) => {
    if (window.confirm("Are you sure you want to delete this form?")) {
      const form = savedForms.find(f => f.id === formId);
      if (form) {
        try {
          // First try to delete from database via API
          const numericId = parseInt(formId);
          if (!isNaN(numericId)) {
            const response = await fetch(`/api/forms/${numericId}`, {
              method: 'DELETE',
              credentials: 'include'
            });
            
            if (response.ok) {
              console.log(`Successfully deleted form ${formId} from database`);
            } else {
              console.warn(`Database deletion failed for form ${formId}, proceeding with local deletion`);
            }
          }
          
          // Update local state regardless of database result
          const updatedForms = savedForms.filter(f => f.id !== formId);
          setSavedForms(updatedForms);
          localStorage.setItem('qa-audit-forms', JSON.stringify(updatedForms));
          
          // Reload forms from database to ensure consistency
          await loadSavedForms();
          
          // Force immediate refresh of the forms list
          setTimeout(() => loadSavedForms(), 500);
          
          // Dispatch event for form deletion - use '*' to refresh all forms
          console.log(`Dispatching form update event for deletion`);
          dispatchFormUpdate('*');
          
          // If the current form is being deleted, reset form state
          if (currentFormId === formId) {
            setFormName("New Audit Form");
            setFormSections([{
              id: generateId('section'),
              name: "Section A",
              type: 'agent',
              questions: []
            }]);
            setCurrentFormId(null);
          }
          
          alert(`Deleted form: ${form.name}`);
        } catch (error) {
          console.error('Error deleting form:', error);
          alert('Failed to delete form. Please try again.');
        }
      }
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Audit Form Builder</h1>
      
      <Tabs defaultValue="editor" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="editor">Form Editor</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="mr-2 h-4 w-4" />
            Preview Form
          </TabsTrigger>
          <TabsTrigger value="library">Form Library ({savedForms.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="editor">
          {showTemplateSelector && !currentFormId ? (
            <Card>
              <CardHeader>
                <CardTitle>Select a Template</CardTitle>
                <CardDescription>
                  Start from a template or create a new form from scratch
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    className="p-4 border rounded-md cursor-pointer hover:border-primary hover:bg-muted transition-colors"
                    onClick={() => {
                      setShowTemplateSelector(false);
                      // Initialize with default sections A-B structure
                      const sectionA: Section = {
                        id: generateId('section'),
                        name: "Section A",
                        type: 'agent',
                        questions: []
                      };
                      const sectionB: Section = {
                        id: generateId('section'),
                        name: "Section B",
                        type: 'questionnaire',
                        questions: []
                      };
                      setFormSections([sectionA, sectionB]);
                      setCurrentSectionId(sectionA.id);
                    }}
                  >
                    <h3 className="font-medium text-lg">Blank Form</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start fresh with an empty form that you can customize
                    </p>
                  </div>

                  <div 
                    className="p-4 border rounded-md cursor-pointer hover:border-primary hover:bg-muted transition-colors bg-gradient-to-br from-blue-50 to-indigo-50"
                    onClick={() => {
                      setShowTemplateSelector(false);
                      setFormName("Advanced Audit Form");
                      
                      // Initialize with advanced form structure where Section A is always visible
                      const sectionA: Section = {
                        id: generateId('section'),
                        name: "Section A",
                        type: 'agent',
                        questions: [],
                        isVisible: true  // Section A is always visible
                      };
                      
                      // Create Section B with conditional visibility for questions within the section
                      const sectionB: Section = {
                        id: generateId('section'),
                        name: "Section B",
                        type: 'questionnaire',
                        questions: [{
                          id: generateId('question'),
                          text: "Was there an issue with the case? (Selecting 'Yes' shows more questions)",
                          type: "dropdown",
                          options: "Yes,NA",
                          weightage: 0,
                          mandatory: true,
                          isFatal: false,
                          enableRemarks: false,
                          grazingLogic: false,
                          controlsVisibility: true,  // This question controls visibility of other questions in this section
                          visibleOnValues: ["Yes"]
                        },
                        // These questions will only be visible when the first question is answered with "Yes"
                        {
                          id: generateId('question'),
                          text: "What was the issue type?",
                          type: "dropdown",
                          options: "Technical,Billing,Service Quality,Product Feature",
                          weightage: 5,
                          mandatory: true,
                          isFatal: false,
                          enableRemarks: true,
                          grazingLogic: false,
                          controlledBy: null // Will be set to first question's ID
                        },
                        {
                          id: generateId('question'),
                          text: "Was the issue resolved?",
                          type: "dropdown",
                          options: "Yes,No,Partial",
                          weightage: 10,
                          mandatory: true,
                          isFatal: false,
                          enableRemarks: true,
                          grazingLogic: false,
                          controlledBy: null // Will be set to first question's ID
                        }]
                      };
                      
                      // Create Section C with internal conditional visibility logic
                      const sectionC: Section = {
                        id: generateId('section'),
                        name: "Section C",
                        type: 'questionnaire',
                        questions: [{
                          id: generateId('question'),
                          text: "Did the agent follow proper procedures? (Selecting 'Yes' shows more questions)",
                          type: "dropdown",
                          options: "Yes,NA",
                          weightage: 0,
                          mandatory: true,
                          isFatal: false,
                          enableRemarks: false,
                          grazingLogic: false,
                          controlsVisibility: true,  // This question controls visibility of other questions in this section
                          visibleOnValues: ["Yes"]
                        },
                        // These questions will only be visible when the first question is answered with "Yes"
                        {
                          id: generateId('question'),
                          text: "How would you rate the agent's procedure knowledge?",
                          type: "dropdown",
                          options: "Excellent,Good,Average,Poor",
                          weightage: 5,
                          mandatory: true,
                          isFatal: false,
                          enableRemarks: true,
                          grazingLogic: false,
                          controlledBy: null // Will be set to first question's ID
                        }]                        
                      };
                      
                      // Create interaction section template that can be repeated
                      const interactionId = generateId('repeatgroup');
                      const interactionSection: Section = {
                        id: generateId('section'),
                        name: "Interaction 1",
                        type: 'interaction',
                        isRepeatable: true,
                        repeatableGroupId: interactionId,
                        maxRepetitions: 100,
                        repetitionIndex: 1,
                        questions: [
                          {
                            id: generateId('question'),
                            text: "Interaction Type",
                            type: "dropdown",
                            options: "Call,Chat,Email,Social Media",
                            weightage: 0,
                            mandatory: true,
                            isFatal: false,
                            enableRemarks: true,
                            grazingLogic: false,
                            nestedDropdowns: true,
                            nestedDropdownMap: {
                              "Call": "Inbound,Outbound,Transfer",
                              "Chat": "Web Chat,Mobile App,WhatsApp",
                              "Email": "Customer Inquiry,Complaint,Follow-up",
                              "Social Media": "Twitter,Facebook,Instagram"
                            }
                          },
                          {
                            id: generateId('question'),
                            text: "Was the greeting appropriate?",
                            type: "dropdown",
                            options: "Yes,No,NA",
                            weightage: 5,
                            mandatory: true,
                            isFatal: false,
                            enableRemarks: true,
                            grazingLogic: false
                          },
                          {
                            id: generateId('question'),
                            text: "Were all customer concerns addressed?",
                            type: "dropdown",
                            options: "Yes,No,Partial",
                            weightage: 10,
                            mandatory: true,
                            isFatal: true,
                            enableRemarks: true,
                            grazingLogic: false
                          },
                          {
                            id: generateId('question'),
                            text: "Was there another interaction?",
                            type: "dropdown",
                            options: "Yes,No",
                            weightage: 0,
                            mandatory: true,
                            isFatal: false,
                            enableRemarks: false,
                            grazingLogic: false,
                            isRepeatable: true,
                            repeatableGroup: interactionId
                          }
                        ]
                      };
                      
                      // Set up intra-section conditional visibility for section B
                      const controlQuestionB = sectionB.questions[0];
                      // Set the controlledBy property for the conditional questions in Section B
                      for (let i = 1; i < sectionB.questions.length; i++) {
                        sectionB.questions[i].controlledBy = controlQuestionB.id;
                      }
                      
                      // Set up intra-section conditional visibility for section C
                      const controlQuestionC = sectionC.questions[0];
                      // Set the controlledBy property for the conditional questions in Section C
                      for (let i = 1; i < sectionC.questions.length; i++) {
                        sectionC.questions[i].controlledBy = controlQuestionC.id;
                      }
                      
                      // The interaction section uses repeatable section logic - no need for conditional visibility setup
                      
                      // Set the form sections (Section A is always visible, while questions in B & C have conditional visibility)
                      setFormSections([sectionA, sectionB, sectionC, interactionSection]);
                      setCurrentSectionId(sectionA.id);
                    }}
                  >
                    <h3 className="font-medium text-lg text-indigo-700">Advanced Form</h3>
                    <p className="text-sm text-indigo-600 mt-1">
                      Create a form with Section A always visible, conditional question visibility within sections B & C, and repeatable interaction sections for ACPT analysis
                    </p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-800">Nested Dropdowns</span>
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-800">Repeatable Sections</span>
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800 animate-pulse">NEW: Conditional Question Visibility</span>
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-800">Multi-level Logic</span>
                    </div>
                  </div>
                  
                  {savedForms.map(form => (
                    <div 
                      key={form.id}
                      className="p-4 border rounded-md cursor-pointer hover:border-primary hover:bg-muted transition-colors"
                      onClick={() => {
                        setShowTemplateSelector(false);
                        setSelectedTemplate(form.id);
                        // Create a copy of the form for editing
                        setFormName(`${form.name} Copy`);
                        
                        // Ensure sections have proper types
                        const sections = (Array.isArray(form.sections) ? form.sections : form.sections?.sections || []).map((section, index) => {
                          let type: 'agent' | 'questionnaire' | 'custom' | undefined = undefined;
                          
                          if (index === 0) {
                            type = 'agent';
                          } else if (index === 1) {
                            type = 'questionnaire';
                          } else {
                            type = 'custom';
                          }
                          
                          return {
                            ...section,
                            id: generateId('section'),
                            type: type || section.type
                          };
                        });
                        
                        setFormSections(sections);
                        setCurrentSectionId(sections[0].id);
                      }}
                    >
                      <h3 className="font-medium text-lg">{form.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(Array.isArray(form.sections) ? form.sections : form.sections?.sections || []).length} sections • {(Array.isArray(form.sections) ? form.sections : form.sections?.sections || []).reduce((total: number, section: any) => total + (section.questions?.length || 0), 0)} questions
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-4">
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Form Structure</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="form-name">Form Name</Label>
                      <Input
                        id="form-name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <Label className="mb-2 block">Sections</Label>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {formSections.map(section => (
                          <div
                            key={section.id}
                            className={`relative p-2 border rounded-md cursor-pointer ${section.id === currentSectionId ? 'bg-muted border-primary' : ''}`}
                          >
                            <div 
                              className="flex-1 pr-8" 
                              onClick={() => setCurrentSection(section.id)}
                            >
                              <div className="font-medium">
                                {section.name}
                                {section.type === 'agent' && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                    Agent Data (No Marks)
                                  </span>
                                )}
                                {section.type === 'interaction' && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                                    Interaction Section
                                  </span>
                                )}
                                {section.controlledBy && (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                                    Conditional Section
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {section.questions.length} questions
                              </div>
                            </div>
                            
                            {/* Delete button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
                              title="Delete Section"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (formSections.length <= 1) {
                                  alert("Cannot delete the last section. A form must have at least one section.");
                                  return;
                                }
                                
                                if (window.confirm(`Are you sure you want to delete the section "${section.name}" and all its questions?`)) {
                                  // Check if this is an Agent Section (Section A) which is required
                                  if (section.type === 'agent' && !formSections.some(s => s.id !== section.id && s.type === 'agent')) {
                                    alert("Cannot delete the Agent Section (Section A). Each form must have one Agent Section.");
                                    return;
                                  }
                                  
                                  // Remove the section
                                  const updatedSections = formSections.filter(s => s.id !== section.id);
                                  setFormSections(updatedSections);
                                  
                                  // If the current section is being deleted, switch to another section
                                  if (currentSectionId === section.id) {
                                    setCurrentSectionId(updatedSections[0]?.id || null);
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2 mt-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="w-full justify-start"
                          onClick={addSection}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Section
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="w-full justify-start text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          onClick={() => {
                            // Create new interaction section
                            const interactionId = generateId('repeatgroup');
                            const newInteractionSection: Section = {
                              id: generateId('section'),
                              name: `Interaction ${formSections.filter(s => s.type === 'interaction').length + 1}`,
                              type: 'interaction',
                              isRepeatable: true,
                              repeatableGroupId: interactionId,
                              maxRepetitions: 100,
                              repetitionIndex: formSections.filter(s => s.type === 'interaction').length + 1,
                              questions: [
                                {
                                  id: generateId('question'),
                                  text: "Interaction Type",
                                  type: "dropdown",
                                  options: "Call,Chat,Email,Social Media",
                                  weightage: 0,
                                  mandatory: true,
                                  isFatal: false,
                                  enableRemarks: true,
                                  grazingLogic: false
                                },
                                {
                                  id: generateId('question'),
                                  text: "Was the greeting appropriate?",
                                  type: "dropdown",
                                  options: "Yes,No,NA",
                                  weightage: 5,
                                  mandatory: true,
                                  isFatal: false,
                                  enableRemarks: true,
                                  grazingLogic: false
                                },
                                {
                                  id: generateId('question'),
                                  text: "Were all customer concerns addressed?",
                                  type: "dropdown",
                                  options: "Yes,No,Partial",
                                  weightage: 10,
                                  mandatory: true,
                                  isFatal: true,
                                  enableRemarks: true,
                                  grazingLogic: false
                                }
                              ]
                            };
                            
                            const updatedSections = [...formSections, newInteractionSection];
                            setFormSections(updatedSections);
                            setCurrentSectionId(newInteractionSection.id);
                          }}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Interaction
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="space-y-2">
                  <Button onClick={saveForm} className="w-full">
                    Save Form
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={resetToTemplateSelection} 
                    className="w-full"
                  >
                    Start Over From Template
                  </Button>
                </div>
              </div>
              
              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {currentSectionId && formSections.find(s => s.id === currentSectionId)?.name 
                        ? `Section: ${formSections.find(s => s.id === currentSectionId)?.name}`
                        : 'No Section Selected'
                      }
                    </CardTitle>
                    <CardDescription>
                      {currentSectionId && formSections.find(s => s.id === currentSectionId)?.type === 'agent' ? (
                        <>
                          <span className="block text-blue-600 font-medium mb-1">
                            Agent Section (No Marking System)
                          </span>
                          Add questions to collect agent information. Questions in this section will not affect the scoring.
                        </>
                      ) : currentSectionId && formSections.find(s => s.id === currentSectionId)?.type === 'interaction' ? (
                        <>
                          <span className="block text-purple-600 font-medium mb-1">
                            Interaction Section
                          </span>
                          Questions in this section track customer interactions and can be repeated during audits.
                        </>
                      ) : currentSectionId && formSections.find(s => s.id === currentSectionId)?.controlledBy ? (
                        <>
                          <span className="block text-orange-600 font-medium mb-1">
                            Conditional Section
                          </span>
                          This section is conditionally visible based on responses to questions in another section.
                        </>
                      ) : (
                        <>Add questions to this section using the form below</>
                      )}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      {showNewSectionInput && (
                        <div className="p-4 border rounded-md bg-blue-50 mb-4">
                          <Label htmlFor="section-name">New Section Name</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              id="section-name"
                              value={newSectionName}
                              onChange={(e) => setNewSectionName(e.target.value)}
                              placeholder="Enter section name..."
                            />
                            <Button onClick={addSection}>Add</Button>
                            <Button variant="outline" onClick={() => setShowNewSectionInput(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    
                      {getCurrentSectionQuestions().map(question => (
                        <div key={question.id} className="p-3 border rounded-md">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <p className={`font-medium ${question.isFatal ? 'text-red-600' : ''}`}>
                                {question.text}
                                {question.isFatal && (
                                  <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                                    Fatal
                                  </span>
                                )}
                                {question.mandatory && (
                                  <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                    Mandatory
                                  </span>
                                )}
                                {question.controlsSection && (
                                  <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                    Controls Section Visibility
                                  </span>
                                )}
                                {question.controlsVisibility && (
                                  <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                    Controls Question Visibility
                                  </span>
                                )}
                                {question.controlledBy && (
                                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                                    Conditionally Visible
                                  </span>
                                )}
                              </p>
                              <div className="text-xs text-muted-foreground mt-1">
                                Type: {question.type} | 
                                {question.type === 'dropdown' || question.type === 'multiSelect' ? 
                                  ` Options: ${question.options} | ` : ''} 
                                Weightage: {question.weightage} points
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent event bubbling
                                  if (currentSectionId) {
                                    console.log("Edit button clicked", { sectionId: currentSectionId, questionId: question.id });
                                    startEditingQuestion(currentSectionId, question.id);
                                  }
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-blue-600"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent event bubbling
                                  if (currentSectionId) {
                                    console.log("Duplicate button clicked", { sectionId: currentSectionId, questionId: question.id });
                                    duplicateQuestion(currentSectionId, question.id);
                                  }
                                }}
                                title="Duplicate question"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-destructive"
                                onClick={() => currentSectionId && removeQuestion(currentSectionId, question.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className={`p-4 border rounded-md ${isEditing ? 'bg-green-50 border-green-200' : 'bg-muted/30'}`}>
                        <h3 className="font-medium text-sm mb-3">
                          {isEditing ? (
                            <span className="flex items-center text-green-700">
                              <Edit className="h-4 w-4 mr-2" /> 
                              Editing Question
                              <span className="ml-2 text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                                Edit Mode
                              </span>
                            </span>
                          ) : 'Add New Question'}
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="question-text">Question Text</Label>
                            <Textarea
                              id="question-text"
                              placeholder="Enter question text..."
                              value={questionText}
                              onChange={(e) => setQuestionText(e.target.value)}
                              className="min-h-[80px]"
                            />
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="question-type">Response Type</Label>
                              <Select
                                value={questionType}
                                onValueChange={(value) => setQuestionType(value as "text" | "dropdown" | "multiSelect" | "number")}
                              >
                                <SelectTrigger id="question-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dropdown">Dropdown</SelectItem>
                                  <SelectItem value="text">Text Input</SelectItem>
                                  <SelectItem value="multiSelect">Multi Select</SelectItem>
                                  <SelectItem value="number">Number Input</SelectItem>
                                  <SelectItem value="date">Date (Calendar)</SelectItem>
                                  <SelectItem value="partner">Partner Dropdown</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Only show weightage for non-agent sections */}
                            {currentSectionId && formSections.find(s => s.id === currentSectionId)?.type !== 'agent' && (
                              <div className="space-y-2">
                                <Label htmlFor="question-weightage">Weightage (Points)</Label>
                                <Input
                                  id="question-weightage"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={questionWeightage}
                                  onChange={(e) => setQuestionWeightage(parseFloat(e.target.value) || 0)}
                                />
                              </div>
                            )}
                          </div>
                          
                          {/* Show options input for dropdown and multiSelect */}
                          {(questionType === 'dropdown' || questionType === 'multiSelect') && (
                            <div className="space-y-2">
                              <Label htmlFor="question-options">
                                Options (comma separated)
                                <span className="text-xs text-muted-foreground ml-2">
                                  Example: Yes,No,NA,Fatal
                                </span>
                              </Label>
                              <Input
                                id="question-options"
                                placeholder="Yes,No,NA"
                                value={questionOptions}
                                onChange={(e) => setQuestionOptions(e.target.value)}
                              />
                              
                              {/* Advanced: Hierarchical dropdowns */}
                              {questionType === 'dropdown' && (
                                <div className="mt-4 p-3 border rounded-md bg-slate-50 border-slate-200">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center">
                                      <Switch
                                        id="enable-hierarchical-dropdown"
                                        checked={!!enableHierarchical}
                                        onCheckedChange={(checked) => {
                                          setEnableHierarchical(checked);
                                          setNestedDropdowns(checked); // Keep both in sync
                                        }}
                                        className="mr-2"
                                      />
                                      <Label htmlFor="enable-hierarchical-dropdown" className="font-semibold">
                                        Hierarchical Dropdown
                                      </Label>
                                    </div>
                                    <Badge variant="outline" className="bg-slate-100 text-slate-800 text-xs">
                                      Advanced
                                    </Badge>
                                  </div>
                                  
                                  {enableHierarchical && (
                                    <div className="space-y-4">
                                      <div className="text-sm text-muted-foreground">
                                        Configure cascading dropdown levels that change based on selection
                                      </div>

                                      {/* Excel Upload for Hierarchical Data */}
                                      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                                            <span className="text-sm font-medium text-blue-900">Upload Excel File</span>
                                          </div>
                                          <Badge variant="outline" className="bg-blue-100 text-blue-800 text-xs">
                                            Quick Setup
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-blue-700 mb-3">
                                          Upload an Excel file with 1-4 columns to automatically configure hierarchical dropdown levels
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="file"
                                            accept=".xlsx,.xls"
                                            onChange={handleFileUpload}
                                            className="text-sm cursor-pointer"
                                            disabled={uploadStatus === 'uploading'}
                                          />
                                          {uploadStatus === 'uploading' && (
                                            <div className="flex items-center text-xs text-blue-600">
                                              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
                                              Processing...
                                            </div>
                                          )}
                                        </div>
                                        {uploadMessage && (
                                          <div className={`mt-2 p-2 rounded text-xs flex items-start gap-2 ${
                                            uploadStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 
                                            uploadStatus === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 
                                            'bg-blue-50 text-blue-700'
                                          }`}>
                                            {uploadStatus === 'success' && <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                                            {uploadStatus === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                                            <span>{uploadMessage}</span>
                                          </div>
                                        )}
                                        {detectedLevel && previewData.length > 0 && (
                                          <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                                            <div className="text-xs font-medium text-blue-900 mb-1">
                                              Preview ({detectedLevel} level{detectedLevel > 1 ? 's' : ''} detected):
                                            </div>
                                            <div className="text-xs text-gray-600 space-y-1">
                                              {previewData.slice(0, 3).map((row: any, idx: number) => (
                                                <div key={idx} className="truncate">
                                                  {row.filter((cell: any) => cell).join(' → ')}
                                                </div>
                                              ))}
                                              {previewData.length > 3 && (
                                                <div className="text-gray-400">... and {previewData.length - 3} more rows</div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Hide lower levels on NA/not chosen option */}
                                      <div className="flex items-center mb-2 p-2 bg-slate-100 rounded-md">
                                        <Checkbox
                                          id="hide-on-na"
                                          checked={hideOnNA}
                                          onCheckedChange={(checked) => setHideOnNA(!!checked)}
                                          className="mr-2"
                                        />
                                        <Label htmlFor="hide-on-na" className="text-sm font-medium">
                                          Hide lower levels when "NA" or no option is selected
                                        </Label>
                                      </div>
                                      
                                      {/* Custom label configuration section */}
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-medium">Custom Labels</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                          <div>
                                            <Label htmlFor="level2-label" className="text-xs">Level 2</Label>
                                            <Input
                                              id="level2-label"
                                              value={level2Label}
                                              onChange={(e) => setLevel2Label(e.target.value)}
                                              placeholder="Category"
                                              className="mt-1 text-sm h-8"
                                            />
                                          </div>
                                          <div>
                                            <Label htmlFor="level3-label" className="text-xs">Level 3</Label>
                                            <Input
                                              id="level3-label"
                                              value={level3Label}
                                              onChange={(e) => setLevel3Label(e.target.value)}
                                              placeholder="Subcategory"
                                              className="mt-1 text-sm h-8"
                                            />
                                          </div>
                                          <div>
                                            <Label htmlFor="level4-label" className="text-xs">Level 4</Label>
                                            <Input
                                              id="level4-label"
                                              value={level4Label}
                                              onChange={(e) => setLevel4Label(e.target.value)}
                                              placeholder="Type"
                                              className="mt-1 text-sm h-8"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Level 1 to Level 2 mapping */}
                                      <div className="space-y-3 pt-3 border-t border-slate-200">
                                        <h4 className="text-sm font-medium">Level 1 → Level 2 Options</h4>
                                        <div className="text-xs text-muted-foreground mb-2">
                                          Define child options for each parent
                                        </div>
                                        
                                        {questionOptions.split(',').map((option) => {
                                          const trimmedOption = option.trim();
                                          if (!trimmedOption) return null;
                                          
                                          return (
                                            <div key={trimmedOption} className="space-y-1">
                                              <Label htmlFor={`nested-${trimmedOption}`} className="text-xs font-medium">
                                                {trimmedOption}
                                              </Label>
                                              <Input
                                                id={`nested-${trimmedOption}`}
                                                placeholder="Option1,Option2,Option3"
                                                value={nestedDropdownMap?.[trimmedOption] || ''}
                                                onChange={(e) => {
                                                  setNestedDropdownMap(prev => ({
                                                    ...prev,
                                                    [trimmedOption]: e.target.value
                                                  }));
                                                }}
                                                className="h-8"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                      
                                      {/* Level 3 configuration */}
                                      <div className="pt-3 border-t border-slate-200">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center">
                                            <Switch
                                              id="enable-third-level"
                                              checked={!!hasThirdLevel}
                                              onCheckedChange={(checked) => setHasThirdLevel(checked)}
                                              className="mr-2"
                                            />
                                            <Label htmlFor="enable-third-level" className="text-sm font-medium">
                                              Enable Level 3
                                            </Label>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {hasThirdLevel && (
                                        <div className="space-y-3">
                                          <h4 className="text-sm font-medium">Level 2 → Level 3 Options</h4>
                                          
                                          {Object.keys(nestedDropdownMap).map(parentOption => {
                                            if (!nestedDropdownMap[parentOption]) return null;
                                            
                                            const childOptions = nestedDropdownMap[parentOption]?.split(',') || [];
                                            return (
                                              <div key={parentOption} className="space-y-2 pl-3 pt-2 border-l border-slate-300">
                                                <h4 className="text-xs font-medium">{parentOption}</h4>
                                                {childOptions.map(childOption => {
                                                  const trimmedChildOption = childOption.trim();
                                                  if (!trimmedChildOption) return null;
                                                  
                                                  return (
                                                    <div key={`${parentOption}-${trimmedChildOption}`} className="ml-2 space-y-1">
                                                      <Label 
                                                        htmlFor={`l3-${parentOption}-${trimmedChildOption}`} 
                                                        className="text-xs font-normal">
                                                        {trimmedChildOption}
                                                      </Label>
                                                      <Input
                                                        id={`l3-${parentOption}-${trimmedChildOption}`}
                                                        placeholder="Option1,Option2,Option3"
                                                        className="text-sm h-8"
                                                        value={thirdLevelMap?.[parentOption]?.[trimmedChildOption] || ''}
                                                        onChange={(e) => {
                                                          setThirdLevelMap(prev => ({
                                                            ...prev,
                                                            [parentOption]: {
                                                              ...(prev[parentOption] || {}),
                                                              [trimmedChildOption]: e.target.value
                                                            }
                                                          }));
                                                        }}
                                                      />
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      
                                      {/* Level 4 configuration */}
                                      {hasThirdLevel && (
                                        <div className="flex items-center justify-between border-t border-blue-200 pt-3">
                                          <div className="flex items-center">
                                            <Switch
                                              id="enable-fourth-level"
                                              checked={!!hasFourthLevel}
                                              onCheckedChange={(checked) => setHasFourthLevel(checked)}
                                              className="mr-2"
                                            />
                                            <Label htmlFor="enable-fourth-level" className="text-sm font-medium text-blue-900">
                                              Enable Level 4 ({level4Label})
                                            </Label>
                                          </div>
                                          <Badge variant="outline" className="bg-blue-100/80 text-blue-800 text-xs">
                                            Expert
                                          </Badge>
                                        </div>
                                      )}
                                      
                                      {hasThirdLevel && hasFourthLevel && (
                                        <div className="space-y-4 p-2 border border-blue-300 rounded-md bg-blue-100/60">
                                          <h4 className="text-sm font-semibold text-blue-900">Level 3 → Level 4 Options</h4>
                                          <p className="text-xs text-blue-800">
                                            For each Level 3 option, define the Level 4 choices that will appear when selected.
                                          </p>
                                          
                                          <div className="max-h-[300px] overflow-y-auto p-1 border border-blue-200 rounded-md">
                                            {Object.keys(thirdLevelMap).map(l1Option => {
                                              if (!thirdLevelMap[l1Option]) return null;
                                              
                                              return Object.keys(thirdLevelMap[l1Option]).map(l2Option => {
                                                if (!thirdLevelMap[l1Option][l2Option]) return null;
                                                
                                                const l3Options = thirdLevelMap[l1Option][l2Option].split(',');
                                                
                                                return (
                                                  <div key={`${l1Option}-${l2Option}`} className="space-y-2 mt-3 border-l-2 border-blue-300 pl-3">
                                                    <h4 className="text-xs font-medium text-blue-800 flex items-center gap-1">
                                                      <span>{l1Option}</span>
                                                      <span className="text-xs">→</span>
                                                      <span>{l2Option}</span>
                                                    </h4>
                                                    
                                                    {l3Options.map(l3Option => {
                                                      const trimmedL3 = l3Option.trim();
                                                      if (!trimmedL3) return null;
                                                      
                                                      return (
                                                        <div key={`${l1Option}-${l2Option}-${trimmedL3}`} className="ml-2">
                                                          <Label 
                                                            htmlFor={`l4-${l1Option}-${l2Option}-${trimmedL3}`} 
                                                            className="text-xs font-medium flex items-center gap-1">
                                                            <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
                                                            <span>{trimmedL3}</span>
                                                            <span className="text-xs text-blue-600">→ {level4Label}</span>
                                                          </Label>
                                                          <Input
                                                            id={`l4-${l1Option}-${l2Option}-${trimmedL3}`}
                                                            placeholder="Option1,Option2,Option3"
                                                            className="mt-1 text-xs"
                                                            value={
                                                              fourthLevelMap?.[l1Option]?.[l2Option]?.[trimmedL3] || ''
                                                            }
                                                            onChange={(e) => {
                                                              setFourthLevelMap(prev => {
                                                                // Create structure if it doesn't exist
                                                                const newMap = { ...prev };
                                                                if (!newMap[l1Option]) newMap[l1Option] = {};
                                                                if (!newMap[l1Option][l2Option]) newMap[l1Option][l2Option] = {};
                                                                
                                                                newMap[l1Option][l2Option][trimmedL3] = e.target.value;
                                                                return newMap;
                                                              });
                                                            }}
                                                          />
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                );
                                              });
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div className="text-sm text-blue-700 pt-2 border-t border-blue-200">
                                        <p className="font-medium">How it works:</p>
                                        <ul className="text-xs space-y-1 mt-1">
                                          <li>• Level 1 options come from the main dropdown options field</li>
                                          <li>• When a user selects a Level 1 option, relevant Level 2 options appear</li>
                                          <li>• Continue with Level 3 and 4 if enabled for deep categorization</li>
                                          <li>• Custom labels help users understand each dropdown's purpose</li>
                                        </ul>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setQuestionOptions("Yes,No,NA")}
                                  className="text-xs"
                                >
                                  Yes/No/NA
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setQuestionOptions("Yes,No,NA,Fatal")}
                                  className="text-xs"
                                >
                                  Yes/No/NA/Fatal
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setQuestionOptions("Excellent,Good,Average,Poor")}
                                  className="text-xs"
                                >
                                  Rating Scale
                                </Button>
                                <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setQuestionOptions("Completed,Missed,Partial")}
                                  className="text-xs"
                                >
                                  Completion Scale
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Common options for all question types */}
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="mandatory" 
                                checked={isMandatory}
                                onCheckedChange={(checked) => setIsMandatory(!!checked)}
                              />
                              <Label htmlFor="mandatory" className="font-medium">
                                Make this question mandatory
                              </Label>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="enableRemarks" 
                                checked={enableRemarks}
                                onCheckedChange={(checked) => setEnableRemarks(!!checked)}
                              />
                              <Label htmlFor="enableRemarks" className="font-medium">
                                Enable remarks field for this question
                              </Label>
                            </div>
                          </div>
                          
                          {/* Only show fatal option for non-agent sections */}
                          {currentSectionId && formSections.find(s => s.id === currentSectionId)?.type !== 'agent' && (
                            <div className="flex flex-col space-y-4 mt-4 p-3 border border-red-200 rounded-md bg-red-50">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="fatal" 
                                  checked={isFatal}
                                  onCheckedChange={(checked) => setIsFatal(!!checked)}
                                />
                                <Label htmlFor="fatal" className="text-red-600 font-medium">
                                  Fatal Parameter
                                </Label>
                              </div>
                              <div className="text-sm text-gray-600 ml-6">
                                <p><strong>Fatal parameter scoring rules:</strong></p>
                                <ul className="list-disc ml-5 mt-1 space-y-1">
                                  <li>If answer is "<strong>Fatal</strong>": All marks for the audit will be set to zero</li>
                                  <li>If answer is "<strong>No</strong>": Marks will be deducted according to question weightage</li>
                                  <li>If answer is "<strong>NA</strong>" or "<strong>Yes</strong>": No marks will be deducted</li>
                                </ul>
                              </div>
                            </div>
                          )}
                          
                          {/* Grazing Logic and Percentage Settings - only show for non-agent sections */}
                          {currentSectionId && formSections.find(s => s.id === currentSectionId)?.type !== 'agent' && (
                            <div className="space-y-4 mt-4 p-3 border border-green-200 rounded-md bg-green-50">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="grazing-logic" 
                                  checked={grazingLogic}
                                  onCheckedChange={(checked) => setGrazingLogic(!!checked)}
                                />
                                <Label htmlFor="grazing-logic" className="font-medium text-green-700">
                                  Enable Grazing Logic
                                </Label>
                              </div>
                              
                              {grazingLogic && (
                                <div className="space-y-3 ml-6">
                                  <div className="space-y-2">
                                    <Label htmlFor="grazing-percentage" className="text-sm">
                                      Grazing Percentage
                                    </Label>
                                    <div className="flex items-center space-x-2">
                                      <Input
                                        id="grazing-percentage"
                                        type="number"
                                        value={grazingPercentage}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          if (!isNaN(value) && value >= 0 && value <= 100) {
                                            setGrazingPercentage(value);
                                          }
                                        }}
                                        min="0"
                                        max="100"
                                        className="max-w-[100px] bg-white"
                                      />
                                      <span className="text-sm text-green-700">%</span>
                                    </div>
                                    <p className="text-xs text-green-600">
                                      If the customer score is above this percentage, the option
                                      selected for this question will not affect the final score.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Conditional Section Settings - only show for agent section dropdowns in advanced template */}
                          {/* Show conditional visibility controls for dropdown questions */}
                          {currentSectionId && questionType === 'dropdown' && (
                            <div className="space-y-4 mt-4 p-3 border border-indigo-200 rounded-md bg-indigo-50">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="controls-visibility" 
                                  checked={controlsVisibility}
                                  onCheckedChange={(checked) => setControlsVisibility(!!checked)}
                                />
                                <Label htmlFor="controls-visibility" className="font-medium text-indigo-700">
                                  This question controls other questions' visibility within this section
                                </Label>
                                {controlsVisibility && (
                                  <Badge className="ml-2 bg-blue-600 hover:bg-blue-600" variant="default">
                                    Controlling visibility
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Section visibility control - only for agent sections in advanced template */}
                              {currentSectionId && selectedTemplate === 'advanced' && 
                               formSections.find(s => s.id === currentSectionId)?.type === 'agent' && (
                                <div className="flex items-center space-x-2 mt-3">
                                  <Checkbox 
                                    id="controls-section" 
                                    checked={controlsSection}
                                    onCheckedChange={(checked) => setControlsSection(!!checked)}
                                  />
                                  <Label htmlFor="controls-section" className="font-medium text-indigo-700">
                                    This question controls entire section visibility
                                  </Label>
                                </div>
                              )}
                              
                              {controlsVisibility && (
                                <div className="space-y-3 ml-6">
                                  <p className="text-xs text-indigo-600">
                                    When auditor selects specific values for this question,
                                    subsequent questions in this section will become visible or hidden.
                                  </p>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm">
                                      Show questions when these values are selected
                                    </Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {questionOptions.split(',').map((option) => (
                                        <div key={option.trim()} className="flex items-center space-x-1 bg-white px-2 py-1 rounded border">
                                          <Checkbox 
                                            id={`visible-question-on-${option.trim()}`}
                                            checked={visibleOnValues.includes(option.trim())}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setVisibleOnValues([...visibleOnValues, option.trim()]);
                                              } else {
                                                setVisibleOnValues(
                                                  visibleOnValues.filter(item => item !== option.trim())
                                                );
                                              }
                                            }}
                                          />
                                          <Label htmlFor={`visible-question-on-${option.trim()}`} className="text-xs">
                                            {option.trim()}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-indigo-700 mt-1">
                                      {visibleOnValues.length === 0 
                                        ? "Select at least one option to control visibility" 
                                        : `Questions will appear when: ${visibleOnValues.join(', ')}`}
                                    </p>
                                    <div className="bg-blue-100 p-2 rounded text-xs text-blue-800 mt-2">
                                      <span className="font-medium">Note:</span> Questions added after this question will be automatically controlled by it.
                                      They will only be visible when the selected values are chosen.
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {controlsSection && (
                                <div className="space-y-3 ml-6">
                                  <p className="text-xs text-indigo-600">
                                    When auditor selects specific values for this question,
                                    additional sections will become visible or hidden.
                                  </p>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm">
                                      Show sections when these values are selected
                                    </Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {questionOptions.split(',').map((option) => (
                                        <div key={option.trim()} className="flex items-center space-x-1 bg-white px-2 py-1 rounded border">
                                          <Checkbox 
                                            id={`visible-on-${option.trim()}`}
                                            checked={visibleOnValues.includes(option.trim())}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setVisibleOnValues([...visibleOnValues, option.trim()]);
                                              } else {
                                                setVisibleOnValues(
                                                  visibleOnValues.filter(item => item !== option.trim())
                                                );
                                              }
                                            }}
                                          />
                                          <Label htmlFor={`visible-on-${option.trim()}`} className="text-xs">
                                            {option.trim()}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-indigo-700 mt-1">
                                      {visibleOnValues.length === 0 
                                        ? "Select at least one option to control visibility" 
                                        : `Additional sections will appear when: ${visibleOnValues.join(', ')}`}
                                    </p>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="controlled-section" className="text-sm">
                                      Section to show/hide
                                    </Label>
                                    <Select 
                                      value={controlledSectionId} 
                                      onValueChange={setControlledSectionId}
                                    >
                                      <SelectTrigger className="w-full bg-white">
                                        <SelectValue placeholder="Select a section" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {formSections
                                          .filter(s => s.type !== 'agent') // Only non-agent sections can be controlled
                                          .map(section => (
                                            <SelectItem key={section.id} value={section.id}>
                                              {section.name}
                                            </SelectItem>
                                          ))
                                        }
                                      </SelectContent>
                                    </Select>
                                    <p className="text-xs text-indigo-600">
                                      This section will only be shown when the selected values are chosen.
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              {/* Question Selection for Controlled By - show for any question type */}
                              <div className="mt-4 space-y-3 p-3 border border-green-200 rounded-md bg-green-50">
                                <div className="space-y-2">
                                  <Label htmlFor="controlled-by" className="text-sm font-medium text-green-700">
                                    Make this question controlled by another question
                                  </Label>
                                  <Select 
                                    value={controlledBy || "none"} 
                                    onValueChange={(value) => setControlledBy(value === "none" ? null : value)}
                                  >
                                    <SelectTrigger className="w-full bg-white">
                                      <SelectValue placeholder="Select a controlling question" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Not controlled by any question</SelectItem>
                                      {currentSectionId && formSections
                                        .find(s => s.id === currentSectionId)?.questions
                                        .filter(q => q.type === 'dropdown' && q.controlsVisibility && q.id !== editingQuestionId)
                                        .map(question => (
                                          <SelectItem key={question.id} value={question.id}>
                                            {question.text} (Dropdown Controller)
                                          </SelectItem>
                                        ))
                                      }
                                    </SelectContent>
                                  </Select>
                                  {controlledBy && (
                                    <div className="mt-2">
                                      <Badge className="bg-green-600 hover:bg-green-600" variant="default">
                                        Controlled visibility
                                      </Badge>
                                      <p className="text-xs text-green-600 mt-1">
                                        This question will only show based on the controlling question's answer.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Repeatable Section Settings - only show for interaction sections */}
                          {currentSectionId && formSections.find(s => s.id === currentSectionId)?.type === 'interaction' && (
                            <div className="space-y-4 mt-4 p-3 border border-purple-200 rounded-md bg-purple-50">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id="repeatable-question"
                                  checked={isRepeatable}
                                  onCheckedChange={(checked) => setIsRepeatable(checked)}
                                />
                                <Label htmlFor="repeatable-question" className="font-medium text-purple-700">
                                  Mark as repeatable question
                                </Label>
                              </div>
                              
                              {isRepeatable && (
                                <div className="space-y-3 ml-6">
                                  <p className="text-xs text-purple-600">
                                    This question will be part of a repeatable block. Answering "Yes" to this question
                                    will cause another interaction block to appear during the audit.
                                  </p>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="repeatable-group" className="text-sm">
                                      Repeatable Group ID
                                    </Label>
                                    <Input
                                      id="repeatable-group"
                                      value={repeatableGroupId}
                                      disabled={true}
                                      readOnly={true}
                                      className="max-w-[300px] bg-purple-100"
                                    />
                                    <p className="text-xs text-purple-600">
                                      This ID connects the question to its repeatable section.
                                      It is automatically assigned for interaction sections.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Conditional Sub-dropdown Settings - show only for dropdown type questions */}
                          {questionType === 'dropdown' && (
                            <div className="space-y-4 mt-4 p-3 border border-blue-200 rounded-md bg-blue-50">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="enable-subdropdown" 
                                  checked={enableSubDropdown} 
                                  onCheckedChange={(checked) => setEnableSubDropdown(!!checked)} 
                                />
                                <Label htmlFor="enable-subdropdown" className="font-medium text-blue-700">
                                  Enable conditional sub-dropdown
                                </Label>
                              </div>
                              
                              {enableSubDropdown && (
                                <div className="space-y-3 pt-2 ml-6">
                                  <div className="space-y-2">
                                    <Label htmlFor="subdropdown-label" className="text-sm">
                                      Sub-dropdown Label
                                    </Label>
                                    <Input
                                      id="subdropdown-label"
                                      value={subDropdownLabel}
                                      onChange={(e) => setSubDropdownLabel(e.target.value)}
                                      placeholder="Enter label (e.g., 'Reason')"
                                      className="bg-white"
                                    />
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-sm">
                                      Show sub-dropdown when these options are selected
                                    </Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {questionOptions.split(',').map((option) => (
                                        <div key={option.trim()} className="flex items-center space-x-1 bg-white px-2 py-1 rounded border">
                                          <Checkbox 
                                            id={`trigger-${option.trim()}`}
                                            checked={subDropdownTriggers.includes(option.trim())}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                setSubDropdownTriggers([...subDropdownTriggers, option.trim()]);
                                              } else {
                                                setSubDropdownTriggers(
                                                  subDropdownTriggers.filter(item => item !== option.trim())
                                                );
                                              }
                                            }}
                                          />
                                          <Label htmlFor={`trigger-${option.trim()}`} className="text-xs">
                                            {option.trim()}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-blue-700 mt-1">
                                      {subDropdownTriggers.length === 0 
                                        ? "Select at least one option to trigger the sub-dropdown" 
                                        : `Sub-dropdown will appear when user selects: ${subDropdownTriggers.join(', ')}`}
                                    </p>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label htmlFor="subdropdown-options" className="text-sm">
                                      Sub-dropdown Options (comma-separated)
                                    </Label>
                                    <Textarea
                                      id="subdropdown-options"
                                      value={subDropdownOptions}
                                      onChange={(e) => setSubDropdownOptions(e.target.value)}
                                      placeholder="Option 1, Option 2, Option 3"
                                      className="bg-white h-20"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {isEditing ? (
                            <div className="flex space-x-2">
                              <Button onClick={updateQuestion} className="flex-1 bg-green-600 hover:bg-green-700">
                                <Check className="h-4 w-4 mr-2" /> Update Question
                              </Button>
                              <Button onClick={cancelEditing} variant="outline" className="flex-1">
                                <X className="h-4 w-4 mr-2" /> Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={addQuestion} className="w-full">
                              Add Question
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="preview">
          <div className="space-y-4">
            {formSections.length === 0 || !formName || formName === "New Audit Form" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Form Preview Not Available</CardTitle>
                  <CardDescription>
                    Create a form with sections and questions to see the preview
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Go to the Form Editor tab to create your form, then come back here to see how it will look with conditional logic.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Interactive Form Preview</CardTitle>
                    <CardDescription>
                      This is how your form will appear to auditors. Try answering questions to see conditional sections and questions show/hide.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-dashed border-blue-200">
                      <p className="text-sm text-blue-700 font-medium mb-2">
                        <Eye className="inline mr-1 h-4 w-4" />
                        Live Preview Mode
                      </p>
                      <p className="text-xs text-blue-600">
                        Answer questions to see sections and questions appear/disappear based on your conditional logic settings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                <ConditionalFormRenderer 
                  form={{
                    id: currentFormId || 'preview',
                    name: formName,
                    sections: formSections
                  }}
                  onAnswerChange={(questionId, value) => {
                    console.log('Preview form answer changed:', { questionId, value });
                  }}
                />
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="library">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Form Library</CardTitle>
                  <CardDescription>
                    View and manage your saved audit forms
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSavedForms}
                  className="shrink-0"
                >
                  Refresh Forms
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {savedForms.map(form => (
                  <div key={form.id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{form.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {(Array.isArray(form.sections) ? form.sections : form.sections?.sections || []).length} sections | {(Array.isArray(form.sections) ? form.sections : form.sections?.sections || []).reduce((total: number, section: any) => total + (section.questions?.length || 0), 0)} questions
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created: {new Date(form.createdAt).toLocaleDateString()}
                          {form.lastModified && ` • Last modified: ${new Date(form.lastModified).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => loadForm(form.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateForm(form.id)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteForm(form.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}