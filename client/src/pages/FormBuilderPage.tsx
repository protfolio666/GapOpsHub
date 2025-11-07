import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlusCircle, Trash2, Copy, Save, FileText, Eye, GripVertical, Upload, FileSpreadsheet, AlertCircle, CheckCircle, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FormTemplate } from "@shared/schema";
import * as XLSX from 'xlsx';

// Helper function to generate IDs
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

interface Question {
  id: string;
  text: string;
  type: "text" | "number" | "dropdown" | "multiSelect" | "date" | "file";
  options?: string;
  required: boolean;
  // Advanced fields
  weightage?: number;
  isFatal?: boolean;
  enableRemarks?: boolean;
  grazingLogic?: boolean;
  grazingPercentage?: number;
  // Conditional sub-dropdown
  showSubDropdownOn?: string[];
  subDropdownOptions?: string;
  subDropdownLabel?: string;
  // Hierarchical dropdowns
  nestedDropdowns?: boolean;
  nestedDropdownMap?: {[key: string]: string};
  level2Label?: string;
  level3Label?: string;
  level4Label?: string;
  hideOnNA?: boolean;
  hasThirdLevel?: boolean;
  thirdLevelMap?: {[key: string]: {[key: string]: string}};
  hasFourthLevel?: boolean;
  fourthLevelMap?: {[key: string]: {[key: string]: {[key: string]: string}}};
  // Conditional visibility
  controlsVisibility?: boolean;
  controlledBy?: string | null;
  visibleOnValues?: string[];
  // Section control
  controlsSection?: boolean;
  controlledSectionId?: string;
}

interface Section {
  id: string;
  name: string;
  type?: 'agent' | 'questionnaire' | 'custom' | 'interaction';
  questions: Question[];
  isRepeatable?: boolean;
  maxRepetitions?: number;
  controlledBy?: string;
}

interface FormSchema {
  sections: Section[];
  version?: string;
}

export default function FormBuilderPage() {
  const [activeTab, setActiveTab] = useState("library");
  const [formName, setFormName] = useState("New Form Template");
  const [formDescription, setFormDescription] = useState("");
  const [currentFormId, setCurrentFormId] = useState<number | null>(null);
  const [formSections, setFormSections] = useState<Section[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  
  // Question form fields - Basic
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<Question["type"]>("text");
  const [questionOptions, setQuestionOptions] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  
  // Question form fields - Advanced
  const [questionWeightage, setQuestionWeightage] = useState(0);
  const [isFatal, setIsFatal] = useState(false);
  const [enableRemarks, setEnableRemarks] = useState(true);
  const [grazingLogic, setGrazingLogic] = useState(false);
  const [grazingPercentage, setGrazingPercentage] = useState(50);
  
  // Conditional sub-dropdown
  const [enableSubDropdown, setEnableSubDropdown] = useState(false);
  const [subDropdownTriggers, setSubDropdownTriggers] = useState<string[]>([]);
  const [subDropdownLabel, setSubDropdownLabel] = useState("Reason");
  const [subDropdownOptions, setSubDropdownOptions] = useState("");
  
  // Hierarchical dropdowns
  const [enableHierarchical, setEnableHierarchical] = useState(false);
  const [nestedDropdowns, setNestedDropdowns] = useState(false);
  const [nestedDropdownMap, setNestedDropdownMap] = useState<{[key: string]: string}>({});
  const [level2Label, setLevel2Label] = useState("Category");
  const [level3Label, setLevel3Label] = useState("Subcategory");
  const [level4Label, setLevel4Label] = useState("Type");
  const [hideOnNA, setHideOnNA] = useState(true);
  const [hasThirdLevel, setHasThirdLevel] = useState(false);
  const [thirdLevelMap, setThirdLevelMap] = useState<{[key: string]: {[key: string]: string}}>({});
  const [hasFourthLevel, setHasFourthLevel] = useState(false);
  const [fourthLevelMap, setFourthLevelMap] = useState<{[key: string]: {[key: string]: {[key: string]: string}}}>({});
  
  // Excel upload state
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [detectedLevel, setDetectedLevel] = useState<number | null>(null);
  
  // Conditional visibility
  const [controlsVisibility, setControlsVisibility] = useState(false);
  const [visibleOnValues, setVisibleOnValues] = useState<string[]>([]);
  const [controlledBy, setControlledBy] = useState<string | null>(null);
  
  // Section control
  const [controlsSection, setControlsSection] = useState(false);
  const [controlledSectionId, setControlledSectionId] = useState<string>("");
  
  // Section settings
  const [sectionType, setSectionType] = useState<Section["type"]>('custom');
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [maxRepetitions, setMaxRepetitions] = useState(5);
  
  // Dialog states
  const [showNewSectionDialog, setShowNewSectionDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showSectionSettingsDialog, setShowSectionSettingsDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [duplicateFormName, setDuplicateFormName] = useState("");
  const [templateToDuplicate, setTemplateToDuplicate] = useState<number | null>(null);
  
  const { toast } = useToast();

  // Fetch all form templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ["/api/form-templates"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/form-templates");
      return response;
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: { name: string; description: string; schemaJson: FormSchema }) =>
      apiRequest("POST", "/api/form-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "Template created",
        description: "Form template has been saved successfully.",
      });
      setActiveTab("library");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to create template",
        description: "Please try again.",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: (data: { id: number; updates: any }) =>
      apiRequest("PATCH", `/api/form-templates/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "Template updated",
        description: "Form template has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to update template",
        description: "Please try again.",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/form-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "Template deleted",
        description: "Form template has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to delete template",
        description: "Please try again.",
      });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: (data: { id: number; name: string }) =>
      apiRequest("POST", `/api/form-templates/${data.id}/duplicate`, { name: data.name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      setShowDuplicateDialog(false);
      setDuplicateFormName("");
      setTemplateToDuplicate(null);
      toast({
        title: "Template duplicated",
        description: "Form template has been duplicated successfully.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to duplicate template",
        description: "Please try again.",
      });
    },
  });

  // Initialize with one empty section
  useEffect(() => {
    if (formSections.length === 0) {
      const initialSection: Section = {
        id: generateId('section'),
        name: "Section 1",
        type: 'custom',
        questions: []
      };
      setFormSections([initialSection]);
      setCurrentSectionId(initialSection.id);
    }
  }, []);

  // Excel file parsing utility
  const parseFileData = (data: any[][]): { level: number; parsedData: any } => {
    if (!data || data.length === 0) {
      throw new Error('No data found in file');
    }

    let validRows = data.filter(row => row.some(cell => cell && cell.toString().trim()));
    if (validRows.length === 0) {
      throw new Error('No valid data rows found');
    }

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
      validRows = validRows.slice(1);
    }

    if (validRows.length === 0) {
      throw new Error('No data rows found after header detection');
    }

    // Find maximum column count across ALL rows (not just first row)
    let maxColumnCount = 0;
    validRows.forEach(row => {
      const columnCount = row.filter(cell => cell && cell.toString().trim()).length;
      if (columnCount > maxColumnCount) {
        maxColumnCount = columnCount;
      }
    });

    if (maxColumnCount < 1 || maxColumnCount > 4) {
      throw new Error('File must have 1-4 columns (Level 1 only, or Level 1 → Level 2/3/4)');
    }

    const level = maxColumnCount;
    const parsedData: any = {};

    const deduplicateOptions = (optionsString: string): string => {
      const options = optionsString.split(',').map(opt => opt.trim()).filter(opt => opt);
      return Array.from(new Set(options)).join(',');
    };

    if (level === 1) {
      const level1Options: string[] = [];
      validRows.forEach(row => {
        const l1 = row[0]?.toString().trim();
        if (l1) level1Options.push(l1);
      });
      const uniqueOptions = Array.from(new Set(level1Options));
      parsedData.level1Options = uniqueOptions.join(',');
    } else if (level === 2) {
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
      Object.keys(nestedMap).forEach(l1 => {
        nestedMap[l1] = deduplicateOptions(nestedMap[l1]);
      });
      parsedData.nestedDropdownMap = nestedMap;
    } else if (level === 3) {
      const nestedMap: {[key: string]: string} = {};
      const thirdMap: {[key: string]: {[key: string]: string}} = {};
      
      validRows.forEach(row => {
        const l1 = row[0]?.toString().trim();
        const l2 = row[1]?.toString().trim();
        const l3 = row[2]?.toString().trim();
        
        if (l1 && l2 && l3) {
          if (nestedMap[l1]) {
            nestedMap[l1] += `,${l2}`;
          } else {
            nestedMap[l1] = l2;
          }
          
          if (!thirdMap[l1]) thirdMap[l1] = {};
          if (thirdMap[l1][l2]) {
            thirdMap[l1][l2] += `,${l3}`;
          } else {
            thirdMap[l1][l2] = l3;
          }
        }
      });
      
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
      const nestedMap: {[key: string]: string} = {};
      const thirdMap: {[key: string]: {[key: string]: string}} = {};
      const fourthMap: {[key: string]: {[key: string]: {[key: string]: string}}} = {};
      
      validRows.forEach(row => {
        const l1 = row[0]?.toString().trim();
        const l2 = row[1]?.toString().trim();
        const l3 = row[2]?.toString().trim();
        const l4 = row[3]?.toString().trim();
        
        if (l1 && l2 && l3 && l4) {
          if (nestedMap[l1]) {
            nestedMap[l1] += `,${l2}`;
          } else {
            nestedMap[l1] = l2;
          }
          
          if (!thirdMap[l1]) thirdMap[l1] = {};
          if (thirdMap[l1][l2]) {
            thirdMap[l1][l2] += `,${l3}`;
          } else {
            thirdMap[l1][l2] = l3;
          }
          
          if (!fourthMap[l1]) fourthMap[l1] = {};
          if (!fourthMap[l1][l2]) fourthMap[l1][l2] = {};
          if (fourthMap[l1][l2][l3]) {
            fourthMap[l1][l2][l3] += `,${l4}`;
          } else {
            fourthMap[l1][l2][l3] = l4;
          }
        }
      });
      
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

  // Handle Excel file upload
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

        if (level === 1) {
          setQuestionOptions(parsedData.level1Options);
          setNestedDropdowns(false);
          setHasThirdLevel(false);
          setHasFourthLevel(false);
          setUploadMessage(`✓ Loaded ${parsedData.level1Options.split(',').length} unique options from ${jsonData.length} rows`);
        } else if (level === 2) {
          const level1Options = Object.keys(parsedData.nestedDropdownMap).join(',');
          setQuestionOptions(level1Options);
          setNestedDropdownMap(parsedData.nestedDropdownMap);
          setNestedDropdowns(true);
          setHasThirdLevel(false);
          setHasFourthLevel(false);
          const level2Count = Object.values(parsedData.nestedDropdownMap).reduce((sum, opts: any) => sum + opts.split(',').length, 0);
          setUploadMessage(`✓ Detected 2-level hierarchy: ${level1Options.split(',').length} L1 options → ${level2Count} L2 options`);
        } else if (level === 3) {
          const level1Options = Object.keys(parsedData.nestedDropdownMap).join(',');
          setQuestionOptions(level1Options);
          setNestedDropdownMap(parsedData.nestedDropdownMap);
          setThirdLevelMap(parsedData.thirdLevelMap);
          setNestedDropdowns(true);
          setHasThirdLevel(true);
          setHasFourthLevel(false);
          const level2Count = Object.values(parsedData.nestedDropdownMap).reduce((sum, opts: any) => sum + opts.split(',').length, 0);
          let level3Count = 0;
          Object.values(parsedData.thirdLevelMap).forEach((l2Map: any) => {
            Object.values(l2Map).forEach((opts: any) => level3Count += opts.split(',').length);
          });
          setUploadMessage(`✓ Detected 3-level hierarchy: ${level1Options.split(',').length} L1 → ${level2Count} L2 → ${level3Count} L3 options`);
        } else if (level === 4) {
          const level1Options = Object.keys(parsedData.nestedDropdownMap).join(',');
          setQuestionOptions(level1Options);
          setNestedDropdownMap(parsedData.nestedDropdownMap);
          setThirdLevelMap(parsedData.thirdLevelMap);
          setFourthLevelMap(parsedData.fourthLevelMap);
          setNestedDropdowns(true);
          setHasThirdLevel(true);
          setHasFourthLevel(true);
          const level2Count = Object.values(parsedData.nestedDropdownMap).reduce((sum, opts: any) => sum + opts.split(',').length, 0);
          let level3Count = 0;
          Object.values(parsedData.thirdLevelMap).forEach((l2Map: any) => {
            Object.values(l2Map).forEach((opts: any) => level3Count += opts.split(',').length);
          });
          let level4Count = 0;
          Object.values(parsedData.fourthLevelMap).forEach((l2Map: any) => {
            Object.values(l2Map).forEach((l3Map: any) => {
              Object.values(l3Map).forEach((opts: any) => level4Count += opts.split(',').length);
            });
          });
          setUploadMessage(`✓ Detected 4-level hierarchy: ${level1Options.split(',').length} L1 → ${level2Count} L2 → ${level3Count} L3 → ${level4Count} L4 options`);
        }

        setUploadStatus('success');
        setTimeout(() => {
          setUploadStatus('idle');
          setUploadMessage('');
        }, 3000);
      } catch (error: any) {
        setUploadStatus('error');
        setUploadMessage(error.message || 'Failed to parse file');
        setTimeout(() => {
          setUploadStatus('idle');
          setUploadMessage('');
        }, 5000);
      }
    };

    reader.onerror = () => {
      setUploadStatus('error');
      setUploadMessage('Failed to read file');
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadMessage('');
      }, 3000);
    };

    reader.readAsBinaryString(file);
  };

  const addSection = () => {
    if (!newSectionName.trim()) {
      toast({
        variant: "destructive",
        title: "Section name required",
        description: "Please enter a section name.",
      });
      return;
    }

    const newSection: Section = {
      id: generateId('section'),
      name: newSectionName,
      type: sectionType,
      questions: [],
      isRepeatable,
      maxRepetitions: isRepeatable ? maxRepetitions : undefined,
    };

    setFormSections([...formSections, newSection]);
    setCurrentSectionId(newSection.id);
    setNewSectionName("");
    setSectionType('custom');
    setIsRepeatable(false);
    setMaxRepetitions(5);
    setShowNewSectionDialog(false);
  };

  const deleteSection = (sectionId: string) => {
    if (formSections.length <= 1) {
      toast({
        variant: "destructive",
        title: "Cannot delete",
        description: "You must have at least one section.",
      });
      return;
    }

    const updatedSections = formSections.filter(s => s.id !== sectionId);
    setFormSections(updatedSections);
    
    if (currentSectionId === sectionId) {
      setCurrentSectionId(updatedSections[0]?.id || null);
    }
  };

  const updateSectionSettings = () => {
    const currentSection = formSections.find(s => s.id === currentSectionId);
    if (!currentSection) return;

    const updatedSections = formSections.map(section => {
      if (section.id === currentSectionId) {
        return {
          ...section,
          type: sectionType,
          isRepeatable,
          maxRepetitions: isRepeatable ? maxRepetitions : undefined,
        };
      }
      return section;
    });

    setFormSections(updatedSections);
    setShowSectionSettingsDialog(false);
  };

  const openSectionSettings = () => {
    const currentSection = formSections.find(s => s.id === currentSectionId);
    if (currentSection) {
      setSectionType(currentSection.type || 'custom');
      setIsRepeatable(currentSection.isRepeatable || false);
      setMaxRepetitions(currentSection.maxRepetitions || 5);
      setShowSectionSettingsDialog(true);
    }
  };

  const addQuestion = () => {
    if (!questionText.trim()) {
      toast({
        variant: "destructive",
        title: "Question text required",
        description: "Please enter a question.",
      });
      return;
    }

    const currentSection = formSections.find(s => s.id === currentSectionId);
    if (!currentSection) return;

    const question: Question = {
      id: editingQuestionId || generateId('question'),
      text: questionText,
      type: questionType,
      options: (questionType === "dropdown" || questionType === "multiSelect") ? questionOptions : undefined,
      required: isRequired,
      weightage: questionWeightage,
      isFatal,
      enableRemarks,
      grazingLogic,
      grazingPercentage,
    };

    // Add sub-dropdown if enabled
    if (enableSubDropdown && subDropdownTriggers.length > 0) {
      question.showSubDropdownOn = subDropdownTriggers;
      question.subDropdownLabel = subDropdownLabel;
      question.subDropdownOptions = subDropdownOptions;
    }

    // Add hierarchical dropdown if enabled
    if (enableHierarchical && nestedDropdowns) {
      question.nestedDropdowns = true;
      question.nestedDropdownMap = nestedDropdownMap;
      question.level2Label = level2Label;
      question.level3Label = level3Label;
      question.level4Label = level4Label;
      question.hideOnNA = hideOnNA;
      question.hasThirdLevel = hasThirdLevel;
      if (hasThirdLevel) question.thirdLevelMap = thirdLevelMap;
      question.hasFourthLevel = hasFourthLevel;
      if (hasFourthLevel) question.fourthLevelMap = fourthLevelMap;
    }

    // Add conditional visibility if enabled
    if (controlsVisibility && visibleOnValues.length > 0) {
      question.controlsVisibility = true;
      question.visibleOnValues = visibleOnValues;
    }
    
    if (controlledBy) {
      question.controlledBy = controlledBy;
    }

    // Add section control if enabled
    if (controlsSection && controlledSectionId) {
      question.controlsSection = true;
      question.controlledSectionId = controlledSectionId;
    }

    const updatedSections = formSections.map(section => {
      if (section.id === currentSectionId) {
        if (editingQuestionId) {
          return {
            ...section,
            questions: section.questions.map(q => q.id === editingQuestionId ? question : q)
          };
        } else {
          return {
            ...section,
            questions: [...section.questions, question]
          };
        }
      }
      return section;
    });

    setFormSections(updatedSections);
    resetQuestionForm();
  };

  const editQuestion = (questionId: string) => {
    const currentSection = formSections.find(s => s.id === currentSectionId);
    const question = currentSection?.questions.find(q => q.id === questionId);
    
    if (question) {
      setQuestionText(question.text);
      setQuestionType(question.type);
      setQuestionOptions(question.options || "");
      setIsRequired(question.required);
      setQuestionWeightage(question.weightage || 0);
      setIsFatal(question.isFatal || false);
      setEnableRemarks(question.enableRemarks || false);
      setGrazingLogic(question.grazingLogic || false);
      setGrazingPercentage(question.grazingPercentage || 50);
      
      // Sub-dropdown
      setEnableSubDropdown(!!(question.showSubDropdownOn && question.showSubDropdownOn.length > 0));
      setSubDropdownTriggers(question.showSubDropdownOn || []);
      setSubDropdownLabel(question.subDropdownLabel || "Reason");
      setSubDropdownOptions(question.subDropdownOptions || "");
      
      // Hierarchical
      setEnableHierarchical(!!question.nestedDropdowns);
      setNestedDropdowns(!!question.nestedDropdowns);
      setNestedDropdownMap(question.nestedDropdownMap || {});
      setLevel2Label(question.level2Label || "Category");
      setLevel3Label(question.level3Label || "Subcategory");
      setLevel4Label(question.level4Label || "Type");
      setHideOnNA(question.hideOnNA !== false);
      setHasThirdLevel(!!question.hasThirdLevel);
      setThirdLevelMap(question.thirdLevelMap || {});
      setHasFourthLevel(!!question.hasFourthLevel);
      setFourthLevelMap(question.fourthLevelMap || {});
      
      // Conditional visibility
      setControlsVisibility(!!question.controlsVisibility);
      setVisibleOnValues(question.visibleOnValues || []);
      setControlledBy(question.controlledBy || null);
      
      // Section control
      setControlsSection(!!question.controlsSection);
      setControlledSectionId(question.controlledSectionId || "");
      
      setEditingQuestionId(questionId);
    }
  };

  const deleteQuestion = (questionId: string) => {
    const updatedSections = formSections.map(section => {
      if (section.id === currentSectionId) {
        return {
          ...section,
          questions: section.questions.filter(q => q.id !== questionId)
        };
      }
      return section;
    });

    setFormSections(updatedSections);
  };

  const resetQuestionForm = () => {
    setQuestionText("");
    setQuestionType("text");
    setQuestionOptions("");
    setIsRequired(true);
    setQuestionWeightage(0);
    setIsFatal(false);
    setEnableRemarks(true);
    setGrazingLogic(false);
    setGrazingPercentage(50);
    setEnableSubDropdown(false);
    setSubDropdownTriggers([]);
    setSubDropdownLabel("Reason");
    setSubDropdownOptions("");
    setEnableHierarchical(false);
    setNestedDropdowns(false);
    setNestedDropdownMap({});
    setLevel2Label("Category");
    setLevel3Label("Subcategory");
    setLevel4Label("Type");
    setHideOnNA(true);
    setHasThirdLevel(false);
    setThirdLevelMap({});
    setHasFourthLevel(false);
    setFourthLevelMap({});
    setControlsVisibility(false);
    setVisibleOnValues([]);
    setControlledBy(null);
    setControlsSection(false);
    setControlledSectionId("");
    setEditingQuestionId(null);
  };

  const saveTemplate = () => {
    if (!formName.trim()) {
      toast({
        variant: "destructive",
        title: "Form name required",
        description: "Please enter a form name.",
      });
      return;
    }

    if (formSections.length === 0 || formSections.every(s => s.questions.length === 0)) {
      toast({
        variant: "destructive",
        title: "Questions required",
        description: "Please add at least one question to your form.",
      });
      return;
    }

    const schemaJson: FormSchema = {
      sections: formSections,
      version: "1.0"
    };

    if (currentFormId) {
      updateTemplateMutation.mutate({
        id: currentFormId,
        updates: {
          name: formName,
          description: formDescription,
          schemaJson,
        }
      });
    } else {
      createTemplateMutation.mutate({
        name: formName,
        description: formDescription,
        schemaJson,
      });
    }
  };

  const loadTemplate = (template: FormTemplate) => {
    setFormName(template.name);
    setFormDescription(template.description || "");
    setCurrentFormId(template.id);
    
    const schema = template.schemaJson as FormSchema;
    setFormSections(schema.sections || []);
    setCurrentSectionId(schema.sections[0]?.id || null);
    setActiveTab("editor");
  };

  const createNewForm = () => {
    setFormName("New Form Template");
    setFormDescription("");
    setCurrentFormId(null);
    const initialSection: Section = {
      id: generateId('section'),
      name: "Section 1",
      type: 'custom',
      questions: []
    };
    setFormSections([initialSection]);
    setCurrentSectionId(initialSection.id);
    resetQuestionForm();
    setActiveTab("editor");
  };

  const handleDuplicate = (templateId: number) => {
    setTemplateToDuplicate(templateId);
    const template = templatesData?.templates?.find((t: FormTemplate) => t.id === templateId);
    if (template) {
      setDuplicateFormName(`${template.name} (Copy)`);
      setShowDuplicateDialog(true);
    }
  };

  const confirmDuplicate = () => {
    if (!duplicateFormName.trim() || !templateToDuplicate) {
      toast({
        variant: "destructive",
        title: "Name required",
        description: "Please enter a name for the duplicate.",
      });
      return;
    }

    duplicateTemplateMutation.mutate({
      id: templateToDuplicate,
      name: duplicateFormName
    });
  };

  const currentSection = formSections.find(s => s.id === currentSectionId);
  const templates = templatesData?.templates || [];
  
  // Get available sections for conditional section control
  const availableSections = formSections.filter(s => s.id !== currentSectionId);
  
  // Get available questions in current section for conditional visibility
  const availableQuestions = currentSection?.questions.filter(q => q.id !== editingQuestionId) || [];

  return (
    <div className="space-y-6" data-testid="page-form-builder">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Form Builder</h1>
          <p className="text-sm text-muted-foreground">Design custom form templates for gap submission</p>
        </div>
        <Button onClick={createNewForm} data-testid="button-new-form">
          <PlusCircle className="h-4 w-4 mr-2" />
          New Form
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="library" data-testid="tab-library">Library</TabsTrigger>
          <TabsTrigger value="editor" data-testid="tab-editor">Editor</TabsTrigger>
          <TabsTrigger value="preview" data-testid="tab-preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Templates</CardTitle>
              <CardDescription>Manage your form templates</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <p className="text-sm text-muted-foreground">Loading templates...</p>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No templates yet</p>
                  <Button onClick={createNewForm}>Create your first template</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template: FormTemplate) => {
                    const schema = template.schemaJson as FormSchema;
                    const totalQuestions = schema.sections?.reduce((acc, s) => acc + s.questions.length, 0) || 0;
                    
                    return (
                      <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                        <CardHeader>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          {template.description && (
                            <CardDescription className="text-xs line-clamp-2">{template.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex gap-2">
                            <Badge variant="secondary">{schema.sections?.length || 0} sections</Badge>
                            <Badge variant="secondary">{totalQuestions} questions</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1"
                              onClick={() => loadTemplate(template)}
                              data-testid={`button-edit-${template.id}`}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDuplicate(template.id)}
                              data-testid={`button-duplicate-${template.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              data-testid={`button-delete-${template.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Form Name</Label>
                <Input 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter form name"
                  data-testid="input-form-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={formDescription} 
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Enter form description"
                  data-testid="input-form-description"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Sections</CardTitle>
                  <Button 
                    size="sm" 
                    onClick={() => setShowNewSectionDialog(true)}
                    data-testid="button-add-section"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {formSections.map((section) => (
                  <div 
                    key={section.id}
                    className={`p-3 rounded-md border cursor-pointer ${
                      currentSectionId === section.id ? 'bg-accent' : 'hover-elevate'
                    }`}
                    onClick={() => setCurrentSectionId(section.id)}
                    data-testid={`section-${section.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{section.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{section.questions.length}</Badge>
                    </div>
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      {section.type && <Badge variant="outline" className="text-xs">{section.type}</Badge>}
                      {section.isRepeatable && <Badge variant="outline" className="text-xs">Repeatable</Badge>}
                    </div>
                    <div className="flex gap-1 mt-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSectionId(section.id);
                          openSectionSettings();
                        }}
                        data-testid={`button-settings-section-${section.id}`}
                      >
                        Settings
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSection(section.id);
                        }}
                        data-testid={`button-delete-section-${section.id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {currentSection ? `${currentSection.name} - Add/Edit Questions` : "Questions"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="basic">
                    <AccordionTrigger>Basic Settings</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Question Text</Label>
                        <Input 
                          value={questionText}
                          onChange={(e) => setQuestionText(e.target.value)}
                          placeholder="Enter question text"
                          data-testid="input-question-text"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <Select value={questionType} onValueChange={(value: any) => setQuestionType(value)}>
                          <SelectTrigger data-testid="select-question-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="dropdown">Dropdown</SelectItem>
                            <SelectItem value="multiSelect">Multi-Select</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="file">File Upload</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(questionType === "dropdown" || questionType === "multiSelect") && !enableHierarchical && (
                        <div className="space-y-2">
                          <Label>Options (comma-separated)</Label>
                          <Input 
                            value={questionOptions}
                            onChange={(e) => setQuestionOptions(e.target.value)}
                            placeholder="Yes, No, NA"
                            data-testid="input-question-options"
                          />
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={isRequired}
                          onCheckedChange={setIsRequired}
                          data-testid="switch-required"
                        />
                        <Label>Required</Label>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced Properties</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="space-y-2">
                        <Label>Weightage (Scoring)</Label>
                        <Input 
                          type="number"
                          value={questionWeightage}
                          onChange={(e) => setQuestionWeightage(Number(e.target.value))}
                          placeholder="0"
                          data-testid="input-weightage"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={isFatal}
                          onCheckedChange={setIsFatal}
                          data-testid="switch-fatal"
                        />
                        <Label>Fatal (Critical failure)</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={enableRemarks}
                          onCheckedChange={setEnableRemarks}
                          data-testid="switch-remarks"
                        />
                        <Label>Enable Remarks Field</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={grazingLogic}
                          onCheckedChange={setGrazingLogic}
                          data-testid="switch-grazing"
                        />
                        <Label>Enable Grazing Logic</Label>
                      </div>

                      {grazingLogic && (
                        <div className="space-y-2">
                          <Label>Grazing Percentage</Label>
                          <Input 
                            type="number"
                            value={grazingPercentage}
                            onChange={(e) => setGrazingPercentage(Number(e.target.value))}
                            placeholder="50"
                            min="0"
                            max="100"
                            data-testid="input-grazing-percentage"
                          />
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {questionType === "dropdown" && (
                    <>
                      <AccordionItem value="hierarchical">
                        <AccordionTrigger>
                          Hierarchical Dropdowns (Excel Upload)
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              checked={enableHierarchical}
                              onCheckedChange={setEnableHierarchical}
                              data-testid="switch-hierarchical"
                            />
                            <Label>Enable Nested Dropdowns (up to 4 levels)</Label>
                          </div>

                          {enableHierarchical && (
                            <div className="space-y-3 p-4 border rounded-md">
                              <div className="space-y-2">
                                <Label>Upload Excel File</Label>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileUpload}
                                    data-testid="input-excel-upload"
                                  />
                                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Format: 1-4 columns for Level 1 → Level 2 → Level 3 → Level 4
                                </p>
                              </div>

                              {uploadStatus !== 'idle' && (
                                <div className={`flex items-center gap-2 p-2 rounded-md ${
                                  uploadStatus === 'success' ? 'bg-green-50 text-green-700' : 
                                  uploadStatus === 'error' ? 'bg-red-50 text-red-700' : 
                                  'bg-blue-50 text-blue-700'
                                }`}>
                                  {uploadStatus === 'success' && <CheckCircle className="h-4 w-4" />}
                                  {uploadStatus === 'error' && <AlertCircle className="h-4 w-4" />}
                                  {uploadStatus === 'uploading' && <FileSpreadsheet className="h-4 w-4" />}
                                  <span className="text-sm">{uploadMessage}</span>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label>Level 2 Label</Label>
                                  <Input 
                                    value={level2Label}
                                    onChange={(e) => setLevel2Label(e.target.value)}
                                    placeholder="Category"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Level 3 Label</Label>
                                  <Input 
                                    value={level3Label}
                                    onChange={(e) => setLevel3Label(e.target.value)}
                                    placeholder="Subcategory"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Level 4 Label</Label>
                                  <Input 
                                    value={level4Label}
                                    onChange={(e) => setLevel4Label(e.target.value)}
                                    placeholder="Type"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Switch 
                                  checked={hideOnNA}
                                  onCheckedChange={setHideOnNA}
                                />
                                <Label>Hide lower levels when NA selected</Label>
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="subdropdown">
                        <AccordionTrigger>Conditional Sub-Dropdown</AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              checked={enableSubDropdown}
                              onCheckedChange={setEnableSubDropdown}
                              data-testid="switch-subdropdown"
                            />
                            <Label>Show additional dropdown based on answer</Label>
                          </div>

                          {enableSubDropdown && (
                            <div className="space-y-3 p-4 border rounded-md">
                              <div className="space-y-2">
                                <Label>Trigger Values (comma-separated)</Label>
                                <Input 
                                  value={subDropdownTriggers.join(',')}
                                  onChange={(e) => setSubDropdownTriggers(e.target.value.split(',').map(v => v.trim()))}
                                  placeholder="No, Fatal"
                                  data-testid="input-subdropdown-triggers"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Sub-dropdown will appear when any of these values is selected
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label>Sub-Dropdown Label</Label>
                                <Input 
                                  value={subDropdownLabel}
                                  onChange={(e) => setSubDropdownLabel(e.target.value)}
                                  placeholder="Reason"
                                  data-testid="input-subdropdown-label"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Sub-Dropdown Options</Label>
                                <Input 
                                  value={subDropdownOptions}
                                  onChange={(e) => setSubDropdownOptions(e.target.value)}
                                  placeholder="Technical issue, Process gap, Other"
                                  data-testid="input-subdropdown-options"
                                />
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </>
                  )}

                  <AccordionItem value="conditional">
                    <AccordionTrigger>Conditional Visibility</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      {availableQuestions.length > 0 && (
                        <div className="space-y-2">
                          <Label>Controlled By Question</Label>
                          <Select value={controlledBy || ""} onValueChange={(value) => setControlledBy(value || null)}>
                            <SelectTrigger data-testid="select-controlled-by">
                              <SelectValue placeholder="Select a question" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">None (always visible)</SelectItem>
                              {availableQuestions.map(q => (
                                <SelectItem key={q.id} value={q.id}>{q.text}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={controlsVisibility}
                          onCheckedChange={setControlsVisibility}
                          data-testid="switch-controls-visibility"
                        />
                        <Label>This question controls other questions</Label>
                      </div>

                      {controlsVisibility && questionType === "dropdown" && (
                        <div className="space-y-2">
                          <Label>Show controlled questions when (comma-separated values)</Label>
                          <Input 
                            value={visibleOnValues.join(',')}
                            onChange={(e) => setVisibleOnValues(e.target.value.split(',').map(v => v.trim()))}
                            placeholder="Yes, Approved"
                            data-testid="input-visible-on-values"
                          />
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="section-control">
                    <AccordionTrigger>Section Control</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={controlsSection}
                          onCheckedChange={setControlsSection}
                          data-testid="switch-controls-section"
                        />
                        <Label>This question controls section visibility</Label>
                      </div>

                      {controlsSection && availableSections.length > 0 && (
                        <div className="space-y-2">
                          <Label>Controlled Section</Label>
                          <Select value={controlledSectionId} onValueChange={setControlledSectionId}>
                            <SelectTrigger data-testid="select-controlled-section">
                              <SelectValue placeholder="Select a section" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSections.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    onClick={addQuestion}
                    className="flex-1"
                    data-testid="button-add-question"
                  >
                    {editingQuestionId ? "Update Question" : "Add Question"}
                  </Button>
                  {editingQuestionId && (
                    <Button 
                      variant="outline"
                      onClick={resetQuestionForm}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-sm font-medium">Questions in this section</Label>
                  {currentSection?.questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No questions yet</p>
                  ) : (
                    currentSection?.questions.map((question, index) => (
                      <div key={question.id} className="p-3 rounded-md border hover-elevate">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium mb-1">{index + 1}. {question.text}</p>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-xs">{question.type}</Badge>
                              {question.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                              {question.isFatal && <Badge variant="destructive" className="text-xs">Fatal</Badge>}
                              {question.weightage && question.weightage > 0 && (
                                <Badge variant="secondary" className="text-xs">Weight: {question.weightage}</Badge>
                              )}
                              {question.nestedDropdowns && <Badge variant="outline" className="text-xs">Nested</Badge>}
                              {question.showSubDropdownOn && <Badge variant="outline" className="text-xs">Sub-dropdown</Badge>}
                              {question.controlsVisibility && <Badge variant="outline" className="text-xs">Controls Q</Badge>}
                              {question.controlsSection && <Badge variant="outline" className="text-xs">Controls S</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => editQuestion(question.id)}
                              data-testid={`button-edit-question-${question.id}`}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => deleteQuestion(question.id)}
                              data-testid={`button-delete-question-${question.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={saveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              <Save className="h-4 w-4 mr-2" />
              {createTemplateMutation.isPending || updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{formName}</CardTitle>
              {formDescription && <CardDescription>{formDescription}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-6">
              {formSections.map((section, sIndex) => (
                <div key={section.id} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold border-b pb-2 flex-1">{section.name}</h3>
                    {section.isRepeatable && (
                      <Badge variant="secondary">Repeatable (max: {section.maxRepetitions})</Badge>
                    )}
                  </div>
                  {section.questions.map((question, qIndex) => (
                    <div key={question.id} className="space-y-2">
                      <Label>
                        {qIndex + 1}. {question.text}
                        {question.required && <span className="text-destructive ml-1">*</span>}
                        {question.isFatal && <Badge variant="destructive" className="ml-2 text-xs">Fatal</Badge>}
                      </Label>
                      {question.type === "text" && (
                        <Input placeholder="Enter your answer" disabled />
                      )}
                      {question.type === "number" && (
                        <Input type="number" placeholder="Enter number" disabled />
                      )}
                      {question.type === "date" && (
                        <Input type="date" disabled />
                      )}
                      {question.type === "dropdown" && !question.nestedDropdowns && (
                        <Select disabled>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options?.split(',').map((opt, i) => (
                              <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {question.type === "dropdown" && question.nestedDropdowns && (
                        <div className="space-y-2">
                          <Select disabled>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Level 1" />
                            </SelectTrigger>
                          </Select>
                          <Select disabled>
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${question.level2Label || 'Level 2'}`} />
                            </SelectTrigger>
                          </Select>
                          {question.hasThirdLevel && (
                            <Select disabled>
                              <SelectTrigger>
                                <SelectValue placeholder={`Select ${question.level3Label || 'Level 3'}`} />
                              </SelectTrigger>
                            </Select>
                          )}
                          {question.hasFourthLevel && (
                            <Select disabled>
                              <SelectTrigger>
                                <SelectValue placeholder={`Select ${question.level4Label || 'Level 4'}`} />
                              </SelectTrigger>
                            </Select>
                          )}
                        </div>
                      )}
                      {question.type === "multiSelect" && (
                        <div className="space-y-2">
                          {question.options?.split(',').map((opt, i) => (
                            <div key={i} className="flex items-center space-x-2">
                              <input type="checkbox" disabled className="h-4 w-4" />
                              <span className="text-sm">{opt.trim()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {question.type === "file" && (
                        <div className="border-2 border-dashed rounded-md p-4 text-center">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload file</p>
                        </div>
                      )}
                      {question.enableRemarks && (
                        <Textarea placeholder="Add remarks (optional)" disabled className="mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Section Dialog */}
      <Dialog open={showNewSectionDialog} onOpenChange={setShowNewSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
            <DialogDescription>Configure your new section</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Name</Label>
              <Input 
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Section name"
                data-testid="input-new-section-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Section Type</Label>
              <Select value={sectionType} onValueChange={(value: any) => setSectionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent Info</SelectItem>
                  <SelectItem value="questionnaire">Questionnaire</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="interaction">Interaction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                checked={isRepeatable}
                onCheckedChange={setIsRepeatable}
              />
              <Label>Repeatable Section</Label>
            </div>
            {isRepeatable && (
              <div className="space-y-2">
                <Label>Max Repetitions</Label>
                <Input 
                  type="number"
                  value={maxRepetitions}
                  onChange={(e) => setMaxRepetitions(Number(e.target.value))}
                  min="1"
                  max="20"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addSection} data-testid="button-confirm-add-section">
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Settings Dialog */}
      <Dialog open={showSectionSettingsDialog} onOpenChange={setShowSectionSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Section Settings</DialogTitle>
            <DialogDescription>Configure section properties</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Type</Label>
              <Select value={sectionType} onValueChange={(value: any) => setSectionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent Info</SelectItem>
                  <SelectItem value="questionnaire">Questionnaire</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="interaction">Interaction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                checked={isRepeatable}
                onCheckedChange={setIsRepeatable}
              />
              <Label>Repeatable Section</Label>
            </div>
            {isRepeatable && (
              <div className="space-y-2">
                <Label>Max Repetitions</Label>
                <Input 
                  type="number"
                  value={maxRepetitions}
                  onChange={(e) => setMaxRepetitions(Number(e.target.value))}
                  min="1"
                  max="20"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSectionSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={updateSectionSettings}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Template</DialogTitle>
            <DialogDescription>Enter a name for the duplicate template</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input 
              value={duplicateFormName}
              onChange={(e) => setDuplicateFormName(e.target.value)}
              placeholder="Template name"
              data-testid="input-duplicate-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmDuplicate}
              disabled={duplicateTemplateMutation.isPending}
              data-testid="button-confirm-duplicate"
            >
              {duplicateTemplateMutation.isPending ? "Duplicating..." : "Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
