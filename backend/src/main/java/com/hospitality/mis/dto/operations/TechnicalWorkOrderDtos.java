package com.hospitality.mis.dto.operations;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public final class TechnicalWorkOrderDtos {
    private TechnicalWorkOrderDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record CreateRequest(@NotBlank String roomId, Long equipmentId, String assignee, @NotBlank String priority,
                                LocalDateTime slaDueAt, String materials) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    @JsonDeserialize(using = UpdateRequestDeserializer.class)
    public record UpdateRequest(@NotNull String status, String resultNote, String assignee, String materials) {}

    public static final class UpdateRequestDeserializer extends StdDeserializer<UpdateRequest> {
        private static final java.util.Set<String> FIELDS = java.util.Set.of("status", "result_note", "assignee", "materials");

        public UpdateRequestDeserializer() { super(UpdateRequest.class); }

        @Override
        public UpdateRequest deserialize(JsonParser parser, com.fasterxml.jackson.databind.DeserializationContext context)
                throws java.io.IOException {
            JsonNode node = parser.getCodec().readTree(parser);
            if (!node.isObject()) throw JsonMappingException.from(parser, "Technical update phải là object");
            var fields = node.fieldNames();
            while (fields.hasNext()) {
                String field = fields.next();
                if (!FIELDS.contains(field)) throw JsonMappingException.from(parser, "Field không được hỗ trợ: " + field);
            }
            return new UpdateRequest(text(node, "status"), text(node, "result_note"),
                    text(node, "assignee"), text(node, "materials"));
        }

        private String text(JsonNode node, String field) {
            JsonNode value = node.get(field);
            return value == null || value.isNull() ? null : value.asText();
        }
    }
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record AcceptanceRequest(@NotBlank String acceptanceNote) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(Long id, String roomId, Long equipmentId, String assignee, String priority,
                           LocalDateTime slaDueAt, String materials, String resultNote, String acceptanceNote,
                           String acceptedBy, LocalDateTime acceptedAt, String status, String createdBy,
                           LocalDateTime createdAt, LocalDateTime updatedAt) {}
}
