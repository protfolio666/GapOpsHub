import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, FileText, Loader2 } from "lucide-react";
import { useFileUpload, type UploadedFile } from "@/hooks/useFileUpload";

// Type definitions matching FormBuilderPage
interface Question {
  id: string;
  text: string;
  type: "text" | "number" | "dropdown" | "multiSelect" | "date" | "file";
  options?: string;
  required: boolean;
  weightage?: number;
  isFatal?: boolean;
  enableRemarks?: boolean;
  grazingLogic?: boolean;
  grazingPercentage?: number;
  showSubDropdownOn?: string[];
  subDropdownOptions?: string;
  subDropdownLabel?: string;
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
  controlsVisibility?: boolean;
  controlledBy?: string | null;
  visibleOnValues?: string[];
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

interface FormResponses {
  [sectionId: string]: {
    [questionId: string]: any;
  };
}

interface DynamicFormRendererProps {
  schema: FormSchema;
  onResponsesChange: (responses: FormResponses) => void;
  initialResponses?: FormResponses;
}

export default function DynamicFormRenderer({ schema, onResponsesChange, initialResponses = {} }: DynamicFormRendererProps) {
  const [responses, setResponses] = useState<FormResponses>(initialResponses);
  const [sectionInstances, setSectionInstances] = useState<{[sectionId: string]: number}>({});
  const [uploadingFiles, setUploadingFiles] = useState<{[key: string]: boolean}>({});
  const { uploadFile } = useFileUpload();

  // Initialize section instances for repeatable sections
  useEffect(() => {
    const instances: {[sectionId: string]: number} = {};
    schema.sections.forEach(section => {
      if (section.isRepeatable) {
        instances[section.id] = 1; // Start with 1 instance
      }
    });
    setSectionInstances(instances);
  }, [schema]);

  const updateResponse = (sectionId: string, questionId: string, value: any, instanceIndex = 0) => {
    const sectionKey = instanceIndex > 0 ? `${sectionId}_${instanceIndex}` : sectionId;
    
    const newResponses = {
      ...responses,
      [sectionKey]: {
        ...responses[sectionKey],
        [questionId]: value
      }
    };
    
    setResponses(newResponses);
    onResponsesChange(newResponses);
  };

  const getResponse = (sectionId: string, questionId: string, instanceIndex = 0): any => {
    const sectionKey = instanceIndex > 0 ? `${sectionId}_${instanceIndex}` : sectionId;
    return responses[sectionKey]?.[questionId] || "";
  };

  // Check if question should be visible based on conditional logic
  const isQuestionVisible = (question: Question, sectionId: string, instanceIndex = 0): boolean => {
    if (!question.controlledBy) return true;
    
    // Get the value of the controlling question
    const controllerValue = getResponse(sectionId, question.controlledBy, instanceIndex);
    
    // Check if this question's visibleOnValues includes the controller's current value
    const visibleValues = question.visibleOnValues || [];
    
    return visibleValues.includes(controllerValue);
  };

  // Check if section should be visible based on controlling question
  const isSectionVisible = (section: Section): boolean => {
    if (!section.controlledBy) return true;
    
    // Find the controlling question in any section
    for (const s of schema.sections) {
      const controllingQuestion = s.questions.find(q => 
        q.controlsSection && q.controlledSectionId === section.id
      );
      
      if (controllingQuestion) {
        const controllerValue = getResponse(s.id, controllingQuestion.id);
        const visibleValues = controllingQuestion.visibleOnValues || [];
        return visibleValues.includes(controllerValue);
      }
    }
    
    return true;
  };

  const addRepeatableInstance = (sectionId: string, maxRepetitions?: number) => {
    const currentCount = sectionInstances[sectionId] || 1;
    const max = maxRepetitions || 10;
    
    if (currentCount < max) {
      setSectionInstances({
        ...sectionInstances,
        [sectionId]: currentCount + 1
      });
    }
  };

  const removeRepeatableInstance = (sectionId: string) => {
    const currentCount = sectionInstances[sectionId] || 1;
    
    if (currentCount > 1) {
      // Clean up responses for the removed instance
      const instanceToRemove = currentCount - 1;
      const sectionKey = `${sectionId}_${instanceToRemove}`;
      
      const newResponses = { ...responses };
      delete newResponses[sectionKey];
      
      setResponses(newResponses);
      onResponsesChange(newResponses);
      
      setSectionInstances({
        ...sectionInstances,
        [sectionId]: currentCount - 1
      });
    }
  };

  const renderQuestion = (question: Question, sectionId: string, instanceIndex = 0) => {
    if (!isQuestionVisible(question, sectionId, instanceIndex)) {
      return null;
    }

    const questionKey = `${sectionId}-${question.id}-${instanceIndex}`;
    const value = getResponse(sectionId, question.id, instanceIndex);

    return (
      <div key={questionKey} className="space-y-3" data-testid={`question-${question.id}`}>
        <Label className="text-sm font-medium">
          {question.text}
          {question.required && <span className="text-destructive ml-1">*</span>}
          {question.isFatal && (
            <Badge variant="destructive" className="ml-2 text-xs">Fatal</Badge>
          )}
          {question.weightage && question.weightage > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">Weight: {question.weightage}</Badge>
          )}
        </Label>

        {question.type === "text" && (
          <Input
            value={value}
            onChange={(e) => updateResponse(sectionId, question.id, e.target.value, instanceIndex)}
            required={question.required}
            data-testid={`input-${question.id}`}
          />
        )}

        {question.type === "number" && (
          <Input
            type="number"
            value={value}
            onChange={(e) => updateResponse(sectionId, question.id, e.target.value, instanceIndex)}
            required={question.required}
            data-testid={`input-${question.id}`}
          />
        )}

        {question.type === "date" && (
          <Input
            type="date"
            value={value}
            onChange={(e) => updateResponse(sectionId, question.id, e.target.value, instanceIndex)}
            required={question.required}
            data-testid={`input-${question.id}`}
          />
        )}

        {question.type === "dropdown" && !question.nestedDropdowns && (
          <div className="space-y-2">
            <Select
              value={value}
              onValueChange={(val) => updateResponse(sectionId, question.id, val, instanceIndex)}
              required={question.required}
            >
              <SelectTrigger data-testid={`select-${question.id}`}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {question.options?.split(',').map((opt, i) => (
                  <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Conditional Sub-Dropdown */}
            {question.showSubDropdownOn && question.showSubDropdownOn.includes(value) && (
              <div className="pl-4 border-l-2 border-primary/20">
                <Label className="text-sm">{question.subDropdownLabel || "Reason"}</Label>
                <Select
                  value={getResponse(sectionId, `${question.id}_sub`, instanceIndex)}
                  onValueChange={(val) => updateResponse(sectionId, `${question.id}_sub`, val, instanceIndex)}
                  required={question.required}
                >
                  <SelectTrigger data-testid={`select-${question.id}-sub`}>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.subDropdownOptions?.split(',').map((opt, i) => (
                      <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Nested/Hierarchical Dropdowns */}
        {question.type === "dropdown" && question.nestedDropdowns && (
          <div className="space-y-2">
            {/* Level 1 */}
            <div>
              <Label className="text-xs text-muted-foreground">Level 1</Label>
              <Select
                value={getResponse(sectionId, `${question.id}_l1`, instanceIndex)}
                onValueChange={(val) => {
                  updateResponse(sectionId, `${question.id}_l1`, val, instanceIndex);
                  // Clear dependent levels
                  updateResponse(sectionId, `${question.id}_l2`, "", instanceIndex);
                  updateResponse(sectionId, `${question.id}_l3`, "", instanceIndex);
                  updateResponse(sectionId, `${question.id}_l4`, "", instanceIndex);
                }}
                required={question.required}
              >
                <SelectTrigger data-testid={`select-${question.id}-l1`}>
                  <SelectValue placeholder="Select Level 1" />
                </SelectTrigger>
                <SelectContent>
                  {question.options?.split(',').map((opt, i) => (
                    <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Level 2 */}
            {getResponse(sectionId, `${question.id}_l1`, instanceIndex) && 
             (!question.hideOnNA || getResponse(sectionId, `${question.id}_l1`, instanceIndex) !== "NA") && (
              <div>
                <Label className="text-xs text-muted-foreground">{question.level2Label || "Level 2"}</Label>
                <Select
                  value={getResponse(sectionId, `${question.id}_l2`, instanceIndex)}
                  onValueChange={(val) => {
                    updateResponse(sectionId, `${question.id}_l2`, val, instanceIndex);
                    updateResponse(sectionId, `${question.id}_l3`, "", instanceIndex);
                    updateResponse(sectionId, `${question.id}_l4`, "", instanceIndex);
                  }}
                  required={question.required}
                >
                  <SelectTrigger data-testid={`select-${question.id}-l2`}>
                    <SelectValue placeholder={`Select ${question.level2Label || "Level 2"}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {question.nestedDropdownMap?.[getResponse(sectionId, `${question.id}_l1`, instanceIndex)]?.split(',').map((opt, i) => (
                      <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Level 3 */}
            {question.hasThirdLevel && 
             getResponse(sectionId, `${question.id}_l2`, instanceIndex) &&
             (!question.hideOnNA || getResponse(sectionId, `${question.id}_l2`, instanceIndex) !== "NA") && (
              <div>
                <Label className="text-xs text-muted-foreground">{question.level3Label || "Level 3"}</Label>
                <Select
                  value={getResponse(sectionId, `${question.id}_l3`, instanceIndex)}
                  onValueChange={(val) => {
                    updateResponse(sectionId, `${question.id}_l3`, val, instanceIndex);
                    updateResponse(sectionId, `${question.id}_l4`, "", instanceIndex);
                  }}
                  required={question.required}
                >
                  <SelectTrigger data-testid={`select-${question.id}-l3`}>
                    <SelectValue placeholder={`Select ${question.level3Label || "Level 3"}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {question.thirdLevelMap?.[getResponse(sectionId, `${question.id}_l1`, instanceIndex)]?.[getResponse(sectionId, `${question.id}_l2`, instanceIndex)]?.split(',').map((opt, i) => (
                      <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Level 4 */}
            {question.hasFourthLevel && 
             getResponse(sectionId, `${question.id}_l3`, instanceIndex) &&
             (!question.hideOnNA || getResponse(sectionId, `${question.id}_l3`, instanceIndex) !== "NA") && (
              <div>
                <Label className="text-xs text-muted-foreground">{question.level4Label || "Level 4"}</Label>
                <Select
                  value={getResponse(sectionId, `${question.id}_l4`, instanceIndex)}
                  onValueChange={(val) => updateResponse(sectionId, `${question.id}_l4`, val, instanceIndex)}
                  required={question.required}
                >
                  <SelectTrigger data-testid={`select-${question.id}-l4`}>
                    <SelectValue placeholder={`Select ${question.level4Label || "Level 4"}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {question.fourthLevelMap?.[getResponse(sectionId, `${question.id}_l1`, instanceIndex)]?.[getResponse(sectionId, `${question.id}_l2`, instanceIndex)]?.[getResponse(sectionId, `${question.id}_l3`, instanceIndex)]?.split(',').map((opt, i) => (
                      <SelectItem key={i} value={opt.trim()}>{opt.trim()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {question.type === "multiSelect" && (
          <div className="space-y-2">
            {question.options?.split(',').map((opt, i) => {
              const optValue = opt.trim();
              const currentValues = (value || "").split(',').filter(Boolean);
              const isChecked = currentValues.includes(optValue);

              return (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      let newValues: string[];
                      if (checked) {
                        newValues = [...currentValues, optValue];
                      } else {
                        newValues = currentValues.filter((v: string) => v !== optValue);
                      }
                      updateResponse(sectionId, question.id, newValues.join(','), instanceIndex);
                    }}
                    data-testid={`checkbox-${question.id}-${i}`}
                  />
                  <span className="text-sm">{optValue}</span>
                </div>
              );
            })}
          </div>
        )}

        {question.type === "file" && (
          <div className="space-y-2">
            <Input
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const uploadKey = `${sectionId}_${question.id}_${instanceIndex}`;
                  setUploadingFiles(prev => ({ ...prev, [uploadKey]: true }));
                  
                  const uploadedFile = await uploadFile(file);
                  
                  setUploadingFiles(prev => ({ ...prev, [uploadKey]: false }));
                  
                  if (uploadedFile) {
                    updateResponse(sectionId, question.id, uploadedFile, instanceIndex);
                  }
                }
              }}
              required={question.required}
              data-testid={`input-${question.id}`}
              disabled={uploadingFiles[`${sectionId}_${question.id}_${instanceIndex}`]}
            />
            
            {uploadingFiles[`${sectionId}_${question.id}_${instanceIndex}`] && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}
            
            {value && typeof value === 'object' && value.originalName && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <FileText className="h-4 w-4" />
                <span>{value.originalName} ({(value.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>
        )}

        {/* Remarks field */}
        {question.enableRemarks && (
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Remarks (Optional)</Label>
            <Textarea
              value={getResponse(sectionId, `${question.id}_remarks`, instanceIndex)}
              onChange={(e) => updateResponse(sectionId, `${question.id}_remarks`, e.target.value, instanceIndex)}
              placeholder="Add any remarks..."
              rows={2}
              data-testid={`textarea-${question.id}-remarks`}
            />
          </div>
        )}
      </div>
    );
  };

  const renderSection = (section: Section) => {
    if (!isSectionVisible(section)) {
      return null;
    }

    const instanceCount = section.isRepeatable ? (sectionInstances[section.id] || 1) : 1;

    return (
      <div key={section.id} className="space-y-4">
        {Array.from({ length: instanceCount }).map((_, instanceIndex) => (
          <Card key={`${section.id}-${instanceIndex}`} data-testid={`section-${section.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{section.name}</CardTitle>
                  {section.type && (
                    <Badge variant="outline" className="text-xs">{section.type}</Badge>
                  )}
                  {section.isRepeatable && instanceCount > 1 && (
                    <Badge variant="secondary" className="text-xs">#{instanceIndex + 1}</Badge>
                  )}
                </div>
                {section.isRepeatable && instanceIndex === instanceCount - 1 && instanceIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRepeatableInstance(section.id)}
                    data-testid={`button-remove-instance-${section.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {section.questions.map(question => renderQuestion(question, section.id, instanceIndex))}
            </CardContent>
          </Card>
        ))}

        {section.isRepeatable && instanceCount < (section.maxRepetitions || 10) && (
          <Button
            variant="outline"
            onClick={() => addRepeatableInstance(section.id, section.maxRepetitions)}
            className="w-full"
            data-testid={`button-add-instance-${section.id}`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another {section.name}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="dynamic-form-renderer">
      {schema.sections.map(renderSection)}
    </div>
  );
}
