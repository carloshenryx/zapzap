import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, UserX, User, AlertCircle, Paperclip, X } from 'lucide-react';
import StarRating from '@/components/survey/StarRating';
import FaceRating from '@/components/survey/FaceRating';
import ProgressIndicator from '@/components/survey/ProgressIndicator';
import NavigationButtons from '@/components/survey/NavigationButtons';
import { toast } from 'sonner';
import { fetchPublicAPI, supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { getGoogleReviewPostSubmitAction } from '@/lib/surveyUtils';



export default function Survey() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenantId = urlParams.get('tenant_id');
  const urlTemplateId = urlParams.get('template_id'); // Specific template ID from URL
  const sourceParam = urlParams.get('source'); // Explicit source from URL
  const fromTotem = urlParams.get('from_totem') === 'true';
  const fromQrCode = urlParams.get('from_qrcode') === 'true';
  const fromClickTotem = urlParams.get('from_clicktotem') === 'true';

  const [currentStep, setCurrentStep] = useState(0);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_cpf: '',
    would_recommend: true,
    comment: '',
    custom_answers: {}
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [generatedVoucher, setGeneratedVoucher] = useState(null);
  const [postSubmitGoogle, setPostSubmitGoogle] = useState({ mode: 'none', link: null });
  const [submittedMeta, setSubmittedMeta] = useState(null);
  const [skipGoogleRedirect, setSkipGoogleRedirect] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [showGoogleRedirect, setShowGoogleRedirect] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherData, setVoucherData] = useState(null);
  const [attachmentFiles, setAttachmentFiles] = useState([]);

  // Survey is public - tenant_id comes from URL
  const effectiveTenantId = urlTenantId;

  const maxAttachments = 5;
  const maxAttachmentSizeBytes = 50 * 1024 * 1024;
  const attachmentsBucket = 'survey-attachments';

  const { data: activeTemplate } = useQuery({
    queryKey: ['active-template', effectiveTenantId, urlTemplateId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;

      // Import supabase
      const { supabase } = await import('@/lib/supabase');

      // If template_id is provided in URL, fetch that specific template
      if (urlTemplateId) {
        console.log('🎯 Loading specific template:', urlTemplateId);
        const { data: specificTemplate, error } = await supabase
          .from('survey_templates')
          .select('*')
          .eq('id', urlTemplateId)
          .eq('tenant_id', effectiveTenantId)
          .single();

        if (error) {
          console.error('Error fetching specific template:', error);
          // Fall through to get active template
        } else if (specificTemplate) {
          // Check usage limit for specific template
          if (specificTemplate.usage_limit?.enabled) {
            const currentUses = specificTemplate.usage_limit.current_uses || 0;
            const maxUses = specificTemplate.usage_limit.max_uses || 0;

            if (currentUses >= maxUses) {
              console.warn('⚠️ Template usage limit reached');
              return null;
            }
          }
          return specificTemplate;
        }
      }

      // Fallback: Get active template
      console.log('📋 Loading active template for tenant');
      const { data: templates, error } = await supabase
        .from('survey_templates')
        .select('*')
        .eq('is_active', true)
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching template:', error);
        return null;
      }

      const template = templates?.[0] || null;

      // Verificar se template atingiu seu limite de usos
      if (template && template.usage_limit?.enabled) {
        const currentUses = template.usage_limit.current_uses || 0;
        const maxUses = template.usage_limit.max_uses || 0;

        // Se atingiu o limite
        if (currentUses >= maxUses) {
          // Se tem fallback, usar o fallback
          if (template.usage_limit.fallback_template_id) {
            const { data: fallbackTemplates } = await supabase
              .from('survey_templates')
              .select('*')
              .eq('id', template.usage_limit.fallback_template_id)
              .eq('tenant_id', effectiveTenantId);

            return fallbackTemplates?.[0] || null;
          }
          // Sem fallback: bloquear pesquisa (retornar null)
          return null;
        }
      }

      return template;
    },
    enabled: !!effectiveTenantId,
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant-info', effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) return null;

      const { supabase } = await import('@/lib/supabase');

      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', effectiveTenantId)
        .single();

      return data || null;
    },
    enabled: !!effectiveTenantId,
  });

  const isSurveyUnavailable = activeTemplate === null && !!effectiveTenantId;

  // Memoize derived variables
  const {
    templateQuestions,
    allowAnonymous,
    design,
    primaryColor,
    secondaryColor,
    fontFamily,
    logoUrl
  } = useMemo(() => {
    const questions = activeTemplate?.questions || [];
    const anon = activeTemplate?.allow_anonymous || false;
    const dsg = activeTemplate?.design || {};

    return {
      templateQuestions: questions,
      allowAnonymous: anon,
      design: dsg,
      primaryColor: dsg.primary_color || '#5423e7',
      secondaryColor: dsg.secondary_color || '#3b82f6',
      fontFamily: dsg.font_family || 'Inter',
      logoUrl: dsg.logo_url
    };
  }, [activeTemplate]);

  // Calculate total steps
  const { anonymousChoiceStep, personalInfoStep, totalSteps } = useMemo(() => {
    const anonStep = allowAnonymous ? 1 : 0;
    const personalStep = !isAnonymous ? 1 : 0;
    const total = anonStep + personalStep + templateQuestions.length + 1;
    return { anonymousChoiceStep: anonStep, personalInfoStep: personalStep, totalSteps: total };
  }, [allowAnonymous, isAnonymous, templateQuestions.length]);

  // Inactivity timer for totem
  useEffect(() => {
    if (!fromTotem) return;

    const handleActivity = () => {
      setLastActivityTime(Date.now());
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const checkInactivity = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime;
      if (inactiveTime > 20000) { // 20 seconds
        window.location.href = `/TotemDisplay?tenant_id=${urlTenantId}`;
      }
    }, 1000);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(checkInactivity);
    };
  }, [fromTotem, lastActivityTime, urlTenantId]);

  // Auto-redirect after submission in totem
  useEffect(() => {
    if (isSubmitted && fromTotem) {
      const timer = setTimeout(() => {
        window.location.href = urlTenantId
          ? `/TotemDisplay?tenant_id=${urlTenantId}`
          : '/TotemDisplay';
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted, fromTotem, urlTenantId]);

  useEffect(() => {
    if (isSubmitted && fromClickTotem) {
      const delayMs = postSubmitGoogle?.mode === 'qrcode' ? 45000 : 15000;
      const timer = setTimeout(() => {
        window.location.href = urlTenantId
          ? `/TotemDisplay?tenant_id=${urlTenantId}`
          : '/TotemDisplay';
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [isSubmitted, fromClickTotem, postSubmitGoogle?.mode, urlTenantId]);

  useEffect(() => {
    if (!isSubmitted || !fromClickTotem) return;
    if (postSubmitGoogle?.mode === 'qrcode') return;
    if (!activeTemplate?.google_redirect?.enabled) return;
    if (!tenant?.google_review_link) return;
    if (!submittedMeta) return;

    const googleAction = getGoogleReviewPostSubmitAction(
      { overall_rating: submittedMeta.overall_rating },
      activeTemplate.google_redirect,
      submittedMeta.source,
      tenant.google_review_link
    );

    if (googleAction.mode === 'qrcode' && googleAction.link) {
      setPostSubmitGoogle(googleAction);
    }
  }, [activeTemplate?.google_redirect, fromClickTotem, isSubmitted, postSubmitGoogle?.mode, submittedMeta, tenant?.google_review_link]);

  if (isSurveyUnavailable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-12 shadow-xl text-center max-w-lg">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Pesquisa Indisponível
          </h2>
          <p className="text-gray-600 mb-6">
            Esta pesquisa atingiu o limite máximo de respostas e não está mais disponível no momento.
          </p>
          <p className="text-sm text-gray-500">
            Entre em contato com a empresa para mais informações.
          </p>
        </div>
      </div>
    );
  }

  const evaluateSkipLogic = (question, answer) => {
    if (!question.skip_logic?.enabled || !question.skip_logic?.conditions?.length) {
      return null;
    }

    for (const condition of question.skip_logic.conditions) {
      const { answer_value, operator, skip_to_question_id } = condition;
      let shouldSkip = false;

      switch (operator) {
        case 'equals':
          shouldSkip = String(answer) === String(answer_value);
          break;
        case 'not_equals':
          shouldSkip = String(answer) !== String(answer_value);
          break;
        case 'greater_than':
          shouldSkip = Number(answer) > Number(answer_value);
          break;
        case 'less_than':
          shouldSkip = Number(answer) < Number(answer_value);
          break;
        case 'greater_or_equal':
          shouldSkip = Number(answer) >= Number(answer_value);
          break;
        case 'less_or_equal':
          shouldSkip = Number(answer) <= Number(answer_value);
          break;
        default:
          shouldSkip = false;
      }

      if (shouldSkip) {
        return skip_to_question_id;
      }
    }

    return null;
  };

  const getCurrentStepIndex = () => {
    if (currentStep === 0 && allowAnonymous) {
      return -2;
    }

    if (allowAnonymous && !isAnonymous && currentStep === 1) {
      return -1;
    }
    if (!allowAnonymous && !isAnonymous && currentStep === 0) {
      return -1;
    }

    let offset = 0;
    if (allowAnonymous) offset++;
    if (!isAnonymous) offset++;

    const questionIndex = currentStep - offset;
    if (questionIndex >= 0 && questionIndex < templateQuestions.length) {
      return questionIndex;
    }

    return -3;
  };

  const validateCurrentStep = () => {
    const stepIndex = getCurrentStepIndex();

    if (stepIndex === -2) {
      return true;
    }

    if (stepIndex === -1) {
      if (!formData.customer_name || formData.customer_name.trim() === '') {
        toast.error('Por favor, informe seu nome para continuar.');
        return false;
      }
      if (!formData.customer_phone || formData.customer_phone.trim() === '') {
        toast.error('Por favor, informe seu telefone para continuar.');
        return false;
      }
      return true;
    }

    if (stepIndex >= 0 && stepIndex < templateQuestions.length) {
      const question = templateQuestions[stepIndex];

      if (question.required) {
        const answer = formData.custom_answers[question.id];

        // Check if answer is provided
        if (answer === undefined || answer === null || answer === '') {
          toast.error(`Por favor, responda a pergunta obrigatória: "${question.question}"`);
          return false;
        }

        // For text questions, check if not just whitespace
        if (question.type === 'text' && typeof answer === 'string' && answer.trim() === '') {
          toast.error(`Por favor, responda a pergunta obrigatória: "${question.question}"`);
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    // Validate before advancing
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleNextWithSkipLogic = (currentQuestionIndex, answer) => {
    // Validate current step first
    if (!validateCurrentStep()) {
      return;
    }

    const currentQuestion = templateQuestions[currentQuestionIndex];
    const skipToQuestionId = evaluateSkipLogic(currentQuestion, answer);

    if (skipToQuestionId) {
      // Verificar ações especiais
      if (skipToQuestionId === '__END_SURVEY__') {
        // Ir direto para o passo final
        setCurrentStep(totalSteps - 1);
        return;
      }
      if (skipToQuestionId === '__GOOGLE_REVIEW__') {
        if (!fromClickTotem) {
          setSkipGoogleRedirect(true);
        }
        setCurrentStep(totalSteps - 1);
        return;
      }

      // Find the target question index
      const targetIndex = templateQuestions.findIndex(q => q.id === skipToQuestionId);
      if (targetIndex !== -1) {
        const offset = (allowAnonymous ? 1 : 0) + (!isAnonymous ? 1 : 0);
        setCurrentStep(offset + targetIndex);
        return;
      }
    }

    // Default: go to next step
    handleNext();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Tem certeza que deseja cancelar a pesquisa?')) {
      if (fromTotem && urlTenantId) {
        window.location.href = `/TotemDisplay?tenant_id=${urlTenantId}`;
      } else {
        window.history.back();
      }
    }
  };

  const handleSubmit = async () => {
    // VALIDAÇÃO CRÍTICA: tenant_id é OBRIGATÓRIO para segurança multi-tenant
    if (!effectiveTenantId) {
      toast.error('Erro: tenant_id não identificado. Operação bloqueada por segurança.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const firstRating = Object.values(formData.custom_answers).find(v => typeof v === 'number');

      // Determine source: prioritize explicit URL parameter
      let source = sourceParam || 'qrcode'; // Default to qrcode if no explicit source

      // Only infer from flags if no explicit source provided
      if (!sourceParam) {
        if (fromClickTotem) source = 'clicktotem';
        else if (fromTotem) source = 'totem';
        else if (fromQrCode) source = 'qrcode';
      }

      // VALIDAÇÃO DUPLA: Garantir que tenant_id está presente antes de criar registro
      if (!effectiveTenantId) {
        throw new Error('SEGURANÇA: Tentativa de criar registro sem tenant_id foi bloqueada');
      }

      // Create survey response via API
      const responseData = await fetchPublicAPI('/surveys?action=create-response', {
        method: 'POST',
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          template_id: activeTemplate?.id || null,
          ...formData,
          is_anonymous: isAnonymous,
          overall_rating: typeof firstRating === 'number' ? firstRating : null,
          source: source
        })
      });

      const response = responseData.response;
      console.log('✅ Survey response created:', response.id);

      const ratingValue = typeof firstRating === 'number' ? firstRating : null;

      const shouldUploadAttachments = !!activeTemplate?.allow_attachments && source !== 'clicktotem' && !!response?.attachments_token && attachmentFiles.length > 0;
      if (shouldUploadAttachments) {
        try {
          const filesMeta = attachmentFiles.map((file) => ({
            name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          }));

          const prepared = await fetchPublicAPI('/surveys?action=create-attachment-uploads', {
            method: 'POST',
            body: JSON.stringify({
              tenant_id: effectiveTenantId,
              response_id: response.id,
              attachments_token: response.attachments_token,
              files: filesMeta,
            }),
          });

          const uploads = prepared.uploads || [];
          const uploaded = [];
          let failed = 0;

          for (let i = 0; i < uploads.length; i++) {
            const u = uploads[i];
            const file = attachmentFiles[i];
            if (!file) continue;

            const { error } = await supabase
              .storage
              .from(attachmentsBucket)
              .uploadToSignedUrl(u.path, u.token, file, { contentType: file.type });

            if (error) {
              failed++;
              continue;
            }

            uploaded.push({
              path: u.path,
              original_name: file.name,
              mime_type: file.type,
              size_bytes: file.size,
            });
          }

          if (uploaded.length > 0) {
            await fetchPublicAPI('/surveys?action=confirm-attachment-uploads', {
              method: 'POST',
              body: JSON.stringify({
                tenant_id: effectiveTenantId,
                response_id: response.id,
                attachments_token: response.attachments_token,
                uploaded,
              }),
            });
          }

          if (failed > 0) {
            toast.error(`Não foi possível anexar ${failed} arquivo(s). Sua resposta foi enviada mesmo assim.`);
          }
        } catch (err) {
          console.error('Attachment upload error:', err);
          toast.error('Não foi possível anexar os arquivos. Sua resposta foi enviada mesmo assim.');
        }
      }

      // TODO: Análise de sentimento - implement later
      // if (formData.comment && formData.comment.trim().length > 0) {
      //   analyzeSentiment(response.id, formData.comment);
      // }

      // INCREMENTAR CONTADOR DE USO DO TEMPLATE
      if (activeTemplate && activeTemplate.usage_limit?.enabled) {
        await fetchPublicAPI('/surveys?action=update-template-usage', {
          method: 'POST',
          body: JSON.stringify({
            template_id: activeTemplate.id,
            increment: 1
          })
        });
        console.log('✅ Template usage counter updated');
      }

      // Verificar se deve gerar voucher
      if (activeTemplate?.voucher_config?.enabled && activeTemplate?.voucher_config?.voucher_id) {
        try {
          console.log('🎟️ Attempting to generate voucher...');
          const voucherResult = await fetchPublicAPI('/vouchers?action=generate', {
            method: 'POST',
            body: JSON.stringify({
              voucher_id: activeTemplate.voucher_config.voucher_id,
              survey_response_id: response.id,
              customer_name: formData.customer_name || null,
              customer_email: formData.customer_email || null,
              customer_phone: formData.customer_phone || null,
              overall_rating: ratingValue,
              would_recommend: formData.would_recommend,
              custom_answers: formData.custom_answers
            })
          });

          if (voucherResult.success && voucherResult.voucher_usage) {
            setGeneratedVoucher({
              ...voucherResult.voucher,
              generated_code: voucherResult.voucher_usage.generated_code,
              expiration_date: new Date(voucherResult.voucher_usage.expiration_date)
            });
            console.log('✅ Voucher generated successfully:', voucherResult.voucher_usage.generated_code);
          } else {
            console.log('ℹ️ Voucher not granted based on conditions or limits');
          }
        } catch (error) {
          console.error('❌ Erro ao gerar voucher:', error);
        }
      }

      let googleReviewLink = tenant?.google_review_link || null;
      if (!googleReviewLink && effectiveTenantId) {
        try {
          const { data } = await supabase
            .from('tenants')
            .select('google_review_link')
            .eq('id', effectiveTenantId)
            .single();
          googleReviewLink = data?.google_review_link || null;
        } catch {
          googleReviewLink = null;
        }
      }

      const googleAction = getGoogleReviewPostSubmitAction(
        { overall_rating: ratingValue },
        activeTemplate?.google_redirect,
        source,
        googleReviewLink
      );
      setPostSubmitGoogle(googleAction);
      setSubmittedMeta({ source, overall_rating: ratingValue });

      setIsSubmitted(true);
      setAttachmentFiles([]);

      if (googleAction.mode === 'redirect' && googleAction.link) {
        setTimeout(() => {
          window.open(googleAction.link, '_blank');
        }, 2000);
      }

      if (skipGoogleRedirect && googleReviewLink && !fromClickTotem) {
        setTimeout(() => {
          window.open(googleReviewLink, '_blank');
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao enviar pesquisa:', error);
      toast.error('Erro ao enviar pesquisa. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerQuestion = (questionId, answer, questionIndex) => {
    setFormData({
      ...formData,
      custom_answers: { ...formData.custom_answers, [questionId]: answer }
    });

    // Auto-advance after answering with skip logic
    setTimeout(() => {
      handleNextWithSkipLogic(questionIndex, answer);
    }, 300);
  };

  const renderPersonalInfoStep = () => (
    <motion.div
      key="personal-info"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6 w-full"
    >
      <h2 className="text-2xl font-bold text-center mb-8" style={{ color: primaryColor }}>
        Seus Dados
      </h2>
      <div className="space-y-4 max-w-md mx-auto">
        {allowAnonymous && (
          <div className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl">
            <Label htmlFor="anonymous" className="text-gray-700 cursor-pointer font-medium">
              Responder anonimamente
            </Label>
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => {
                setIsAnonymous(checked);
                if (checked) {
                  setFormData({
                    ...formData,
                    customer_name: '',
                    customer_email: '',
                    customer_phone: '',
                    customer_cpf: ''
                  });
                }
              }}
            />
          </div>
        )}
        <div>
          <Label htmlFor="name" className="text-gray-700">Nome Completo</Label>
          <Input
            id="name"
            placeholder="Seu nome completo"
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            className="h-12 rounded-xl border-gray-300 focus:border-indigo-500"
          />
        </div>
        <div>
          <Label htmlFor="phone" className="text-gray-700">Telefone</Label>
          <Input
            id="phone"
            placeholder="(00) 00000-0000"
            value={formData.customer_phone}
            onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
            className="h-12 rounded-xl border-gray-300"
          />
        </div>
        <div>
          <Label htmlFor="email" className="text-gray-700">Email (opcional)</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            value={formData.customer_email}
            onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
            className="h-12 rounded-xl border-gray-300"
          />
        </div>
        <div>
          <Label htmlFor="cpf" className="text-gray-700">CPF (opcional)</Label>
          <Input
            id="cpf"
            placeholder="000.000.000-00"
            value={formData.customer_cpf}
            onChange={(e) => setFormData({ ...formData, customer_cpf: e.target.value })}
            className="h-12 rounded-xl border-gray-300"
          />
        </div>
        <Button
          onClick={handleNext}
          className="w-full h-12 mt-6 rounded-xl font-semibold"
          style={{ backgroundColor: primaryColor }}
        >
          Continuar
        </Button>
      </div>
    </motion.div>
  );

  const renderQuestion = (question, index) => {
    switch (question.type) {
      case 'stars':
      case 'rating':
        return (
          <motion.div
            key={`question-${index}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="text-center space-y-8"
          >
            <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>
              {question.question}
            </h2>
            <div className="flex justify-center">
              <StarRating
                value={formData.custom_answers[question.id] || 0}
                onChange={(val) => handleAnswerQuestion(question.id, val, index)}
                size="xl"
              />
            </div>
          </motion.div>
        );

      case 'faces':
        return (
          <motion.div
            key={`question-${index}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="text-center space-y-8 w-full"
          >
            <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>
              {question.question}
            </h2>
            <FaceRating
              value={formData.custom_answers[question.id]}
              onChange={(val) => handleAnswerQuestion(question.id, val, index)}
            />
          </motion.div>
        );

      case 'boolean':
        return (
          <motion.div
            key={`question-${index}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-bold text-center" style={{ color: primaryColor }}>
              {question.question}
            </h2>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswerQuestion(question.id, 'Sim', index)}
                className="p-6 rounded-2xl border-2 transition-all"
                style={{
                  borderColor: formData.custom_answers[question.id] === 'Sim' ? primaryColor : '#e5e7eb',
                  backgroundColor: formData.custom_answers[question.id] === 'Sim' ? `${primaryColor}10` : 'white'
                }}
              >
                <p className="text-2xl font-bold" style={{ color: formData.custom_answers[question.id] === 'Sim' ? primaryColor : '#6b7280' }}>
                  ✓ Sim
                </p>
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswerQuestion(question.id, 'Não', index)}
                className="p-6 rounded-2xl border-2 transition-all"
                style={{
                  borderColor: formData.custom_answers[question.id] === 'Não' ? '#ef4444' : '#e5e7eb',
                  backgroundColor: formData.custom_answers[question.id] === 'Não' ? '#ef444410' : 'white'
                }}
              >
                <p className="text-2xl font-bold" style={{ color: formData.custom_answers[question.id] === 'Não' ? '#ef4444' : '#6b7280' }}>
                  ✗ Não
                </p>
              </motion.button>
            </div>
          </motion.div>
        );

      case 'text':
        return (
          <motion.div
            key={`question-${index}`}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-center" style={{ color: primaryColor }}>
              {question.question}
            </h2>
            <Input
              placeholder="Digite sua resposta"
              value={formData.custom_answers[question.id] || ''}
              onChange={(e) => setFormData({
                ...formData,
                custom_answers: { ...formData.custom_answers, [question.id]: e.target.value }
              })}
              className="h-14 rounded-xl border-gray-300 text-lg"
            />
            <Button
              onClick={handleNext}
              className="w-full h-12 rounded-xl font-semibold"
              style={{ backgroundColor: primaryColor }}
            >
              Continuar
            </Button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const renderFinalStep = () => (
    <motion.div
      key="final-step"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      <h2 className="text-2xl font-bold text-center" style={{ color: primaryColor }}>
        Últimas Perguntas
      </h2>

      <div className="flex items-center justify-between p-5 bg-gray-50 rounded-2xl">
        <Label htmlFor="recommend" className="text-gray-700 cursor-pointer font-medium">
          Você nos recomendaria?
        </Label>
        <Switch
          id="recommend"
          checked={formData.would_recommend}
          onCheckedChange={(checked) => setFormData({ ...formData, would_recommend: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment" className="text-gray-700">
          Deixe um comentário (opcional)
        </Label>
        <Textarea
          id="comment"
          placeholder="Conte-nos mais sobre sua experiência..."
          value={formData.comment}
          onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
          className="min-h-[120px] rounded-xl border-gray-300 resize-none"
        />
      </div>

      {!!activeTemplate?.allow_attachments && !(sourceParam === 'clicktotem' || fromClickTotem) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-600" />
            <Label className="text-gray-700">Anexos (opcional)</Label>
          </div>
          <Input
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={(e) => {
              const selected = Array.from(e.target.files || []);
              e.target.value = '';

              const next = [...attachmentFiles];
              for (const file of selected) {
                if (next.length >= maxAttachments) {
                  toast.error(`Máximo de ${maxAttachments} arquivos`);
                  break;
                }
                const mt = (file.type || '').toLowerCase();
                if (!(mt.startsWith('image/') || mt.startsWith('video/') || mt.startsWith('audio/'))) {
                  toast.error(`Tipo não suportado: ${file.name}`);
                  continue;
                }
                if (file.size > maxAttachmentSizeBytes) {
                  toast.error(`Arquivo muito grande (máx. 50MB): ${file.name}`);
                  continue;
                }
                next.push(file);
              }
              setAttachmentFiles(next);
            }}
            className="h-12 rounded-xl border-gray-300 bg-white"
          />
          <p className="text-xs text-gray-500">Até {maxAttachments} arquivos • Máx. 50MB por arquivo • Fotos, vídeos e áudios</p>
          {attachmentFiles.length > 0 && (
            <div className="space-y-2">
              {attachmentFiles.map((file, idx) => (
                <div key={`${file.name}-${file.size}-${idx}`} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setAttachmentFiles(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full h-14 rounded-xl font-semibold text-lg shadow-lg transition-all"
        style={{ backgroundColor: primaryColor }}
      >
        {isSubmitting ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
          />
        ) : (
          'Enviar Avaliação'
        )}
      </Button>
    </motion.div>
  );

  if (isSubmitted) {
    const showVoucher = !!generatedVoucher;
    const showGoogleQr = postSubmitGoogle?.mode === 'qrcode' && !!postSubmitGoogle.link;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-3xl p-8 md:p-12 shadow-xl text-center w-full max-w-3xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckCircle2 className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            Obrigado!
          </h2>
          <p className="text-gray-500 mb-6">
            Sua opinião é muito importante para continuarmos melhorando.
          </p>

          <div className={`mt-8 grid grid-cols-1 gap-6 ${showVoucher && showGoogleQr ? 'md:grid-cols-2' : ''}`}>
            {generatedVoucher && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="p-6 rounded-2xl border-2 border-dashed h-full"
                style={{
                  borderColor: generatedVoucher.design?.background_color || primaryColor,
                  backgroundColor: `${generatedVoucher.design?.background_color || primaryColor}10`
                }}
              >
                <div className="text-4xl mb-3">{generatedVoucher.design?.icon || '🎁'}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Você ganhou um voucher!
                </h3>
                <p className="text-sm text-gray-600 mb-4">{generatedVoucher.name}</p>

                <div className="bg-white rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Seu código:</p>
                  <p className="text-2xl font-bold font-mono tracking-wider" style={{ color: generatedVoucher.design?.background_color }}>
                    {generatedVoucher.generated_code}
                  </p>
                </div>

                {generatedVoucher.type === 'discount_percentage' && (
                  <p className="text-lg font-semibold text-gray-700">
                    {generatedVoucher.discount_percentage}% de desconto
                  </p>
                )}
                {generatedVoucher.type === 'discount_fixed' && (
                  <p className="text-lg font-semibold text-gray-700">
                    R$ {generatedVoucher.discount_fixed} de desconto
                  </p>
                )}
                {generatedVoucher.type === 'gift' && (
                  <p className="text-sm text-gray-700">
                    {generatedVoucher.gift_description}
                  </p>
                )}
                {generatedVoucher.type === 'free_shipping' && (
                  <p className="text-lg font-semibold text-gray-700">
                    Frete Grátis
                  </p>
                )}

                {generatedVoucher.custom_message && (
                  <p className="text-sm text-gray-600 mt-3 italic">
                    "{generatedVoucher.custom_message}"
                  </p>
                )}

                <p className="text-xs text-gray-400 mt-4">
                  Válido até: {new Date(generatedVoucher.expiration_date).toLocaleDateString('pt-BR')}
                </p>
              </motion.div>
            )}

            {showGoogleQr && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-2xl border border-gray-200 bg-gray-50 h-full"
              >
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  Avalie no Google
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Escaneie o QR Code com seu celular para abrir o Google e deixar sua avaliação.
                </p>
                <div className="bg-white p-4 rounded-2xl inline-block shadow-sm">
                  <QRCodeSVG
                    value={postSubmitGoogle.link}
                    size={220}
                    level="H"
                    includeMargin={true}
                    fgColor={primaryColor}
                    {...(logoUrl && {
                      imageSettings: {
                        src: logoUrl,
                        height: 48,
                        width: 48,
                        excavate: true,
                      }
                    })}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {fromTotem && (
            <p className="text-sm text-gray-400 mt-6">
              Retornando ao totem em 4 segundos...
            </p>
          )}
          {fromClickTotem && (
            <p className="text-sm text-gray-400 mt-6">
              Retornando ao totem em {showGoogleQr ? '45' : '15'} segundos...
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  const stepIndex = getCurrentStepIndex();

  const surveyPageBackground = activeTemplate?.design?.background_image_url
    ? {
      backgroundImage: `url(${activeTemplate.design.background_image_url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
    : {};

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4"
      style={{ fontFamily: fontFamily, ...surveyPageBackground }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Logo do Tenant (prioridade) */}
        {tenant?.show_logo_in_survey && tenant?.logo_url && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <img
              src={tenant.logo_url}
              alt="Logo da Empresa"
              className="h-20 mx-auto object-contain drop-shadow-lg"
            />
          </motion.div>
        )}

        {/* Logo do Template (fallback) */}
        {(!tenant?.show_logo_in_survey || !tenant?.logo_url) && logoUrl && (
          <div className="text-center mb-6">
            <img src={logoUrl} alt="Logo" className="h-16 mx-auto" />
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {activeTemplate?.name || 'Pesquisa de Satisfação'}
          </h1>
          <p className="text-gray-500">
            Sua opinião nos ajuda a melhorar
          </p>
        </div>

        {/* Progress Indicator */}
        <ProgressIndicator
          currentStep={currentStep}
          totalSteps={totalSteps}
          primaryColor={primaryColor}
        />

        {/* Navigation Buttons */}
        <NavigationButtons
          onBack={handleBack}
          onCancel={handleCancel}
          showBack={currentStep > 0}
          showCancel={true}
          primaryColor={primaryColor}
        />

        {/* Content Card */}
        <motion.div
          className="bg-white rounded-3xl p-8 shadow-xl min-h-[400px] flex items-center justify-center"
          layout
        >
          <AnimatePresence mode="wait">
            {/* Anonymous Choice - Step 0 (if allowed) */}
            {stepIndex === -2 && (
              <motion.div
                key="anonymous-choice"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full space-y-6"
              >
                <h2 className="text-2xl font-bold text-center" style={{ color: primaryColor }}>
                  Como deseja responder?
                </h2>
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsAnonymous(false);
                      handleNext();
                    }}
                    className="p-6 rounded-2xl border-2 border-gray-200 hover:border-indigo-500 transition-all"
                  >
                    <User className="w-10 h-10 mx-auto mb-3 text-indigo-600" />
                    <p className="font-semibold text-gray-700">Com Identificação</p>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsAnonymous(true);
                      handleNext();
                    }}
                    className="p-6 rounded-2xl border-2 border-gray-200 hover:border-gray-500 transition-all"
                  >
                    <UserX className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    <p className="font-semibold text-gray-700">Anônimo</p>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Personal Info Step */}
            {stepIndex === -1 && renderPersonalInfoStep()}

            {/* Questions */}
            {stepIndex >= 0 && stepIndex < templateQuestions.length && renderQuestion(templateQuestions[stepIndex], stepIndex)}

            {/* Final Step */}
            {stepIndex === -3 && renderFinalStep()}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
