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
import java.time.LocalDate;

public final class HousekeepingDtos {
    private HousekeepingDtos() {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record CreateRequest(@NotBlank String roomId, String assignee, String note, LocalDate shiftDate, String shiftCode) {
        public CreateRequest(String roomId,String assignee,String note){this(roomId,assignee,note,null,null);}
    }
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonIgnoreProperties(ignoreUnknown = false)
    @JsonDeserialize(using = UpdateRequestDeserializer.class)
    public record UpdateRequest(@NotNull String status, String note, String assignee) {}

    public static final class UpdateRequestDeserializer extends StdDeserializer<UpdateRequest> {
        private static final java.util.Set<String> FIELDS = java.util.Set.of("status", "note", "assignee");

        public UpdateRequestDeserializer() { super(UpdateRequest.class); }

        @Override
        public UpdateRequest deserialize(JsonParser parser, com.fasterxml.jackson.databind.DeserializationContext context)
                throws java.io.IOException {
            JsonNode node = parser.getCodec().readTree(parser);
            if (!node.isObject()) throw JsonMappingException.from(parser, "Housekeeping update phải là object");
            var fields = node.fieldNames();
            while (fields.hasNext()) {
                String field = fields.next();
                if (!FIELDS.contains(field)) throw JsonMappingException.from(parser, "Field không được hỗ trợ: " + field);
            }
            return new UpdateRequest(text(node, "status"), text(node, "note"), text(node, "assignee"));
        }

        private String text(JsonNode node, String field) {
            JsonNode value = node.get(field);
            return value == null || value.isNull() ? null : value.asText();
        }
    }
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Response(Long id, String roomId, String assignee, String status, boolean checklistComplete,
                           boolean blockingIncident, String note, String assignedBy, LocalDateTime updatedAt) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AssignedRoom(Long taskId, String roomId, String status) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ShiftAssignmentResponse(String employeeId, String fullName, String shiftCode, java.util.List<AssignedRoom> rooms) {}
}
